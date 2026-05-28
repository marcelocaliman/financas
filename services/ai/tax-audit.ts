import "server-only";
import { z } from "zod";
import { getOpenAI, OPENAI_MODEL, estimateCostCents } from "@/lib/openai/client";
import { getAuditTotals } from "@/services/ir/audit";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Auditoria fiscal pré-declaração via IA.
 *
 * Usa números reais do app (audit totals + rendimentos detalhados + lista de
 * dedutíveis) pra pedir pra IA cruzar e detectar:
 *  - Gaps prováveis (ex: plano de saúde com 8 meses ao invés de 12)
 *  - Receitas comuns ausentes (ex: dividendos típicos que pararam de aparecer)
 *  - Erros de classificação (CDB no tributável quando devia ser exclusivo)
 *  - Otimizações (qual modelo escolher, dedução faltando)
 *
 * Não substitui contador. Marca tudo como sugestão.
 */

const FindingSchema = z.object({
  severity: z
    .enum(["critical", "warning", "info"])
    .describe(
      "critical = quase certo um erro/omissão grave, warning = vale revisar, info = otimização ou observação útil",
    ),
  category: z
    .enum([
      "rendimentos",
      "bens",
      "dividas",
      "dedutiveis",
      "imposto",
      "classificacao",
      "outros",
    ])
    .describe("Em que ficha/área da declaração se encaixa"),
  title: z
    .string()
    .describe("Título curto da observação (até 60 caracteres)"),
  description: z
    .string()
    .describe(
      "Explicação clara do que foi detectado, em 2-3 frases. Cite valores específicos quando relevante.",
    ),
  suggestion: z
    .string()
    .describe(
      "Ação concreta sugerida (ex: 'Verifique no informe da operadora se faltam meses', 'Considere migrar pro modelo completo')",
    ),
  estimated_impact_brl: z
    .number()
    .nullable()
    .describe(
      "Impacto financeiro estimado em BRL (negativo se aumenta imposto, positivo se reduz). null se não dá pra estimar.",
    ),
});

const AuditAiResultSchema = z.object({
  overall_health: z
    .enum(["good", "needs_review", "concerning"])
    .describe(
      "good = parece pronto, needs_review = pendências moderadas, concerning = ainda falta coisa importante",
    ),
  summary: z
    .string()
    .describe(
      "2-3 frases de panorama: quão completo está o ano, principais lacunas, recomendação geral",
    ),
  findings: z.array(FindingSchema).describe("Lista priorizada de achados"),
  recommended_model: z
    .enum(["simples", "completo"])
    .describe("Modelo de declaração recomendado dado o cenário"),
  recommended_model_reasoning: z
    .string()
    .describe("1-2 frases explicando por que esse modelo"),
});

export type AuditAiResult = z.infer<typeof AuditAiResultSchema>;
export type Finding = z.infer<typeof FindingSchema>;

const SYSTEM_PROMPT = `Você é um contador especialista em IRPF brasileiro,
auditando uma declaração antes do envio. Recebe dados extraídos do sistema
financeiro do contribuinte e identifica:

1. OMISSÕES PROVÁVEIS: rendimentos que normalmente apareceriam mas não estão
   (ex: dividendos com gap de meses, plano de saúde com menos de 12 cobranças,
   distribuição de lucros PJ ausente quando há pró-labore).

2. ERROS DE CLASSIFICAÇÃO: rendimento em ficha errada
   (ex: CDB em tributável quando devia ser exclusivo na fonte).

3. INCONSISTÊNCIAS: valores que destoam de padrões esperados
   (ex: bens caíram drasticamente sem venda registrada, dívida some).

4. OTIMIZAÇÕES: deduções típicas ausentes (INSS, PGBL, educação dependente),
   escolha de modelo (simples vs completo).

Seja CONSERVADOR mas CONCRETO:
- Quando indicar omissão, cite valor/quantidade observada vs esperada.
- Estimate impact_brl quando houver base (ex: IRRF a recuperar, redução de imposto).
- Nunca afirme erro sem evidência — use linguagem condicional ("provavelmente",
  "pode estar faltando").

Retorne SOMENTE JSON conforme schema. Sem markdown.`;

export async function runTaxAudit(
  year: number,
): Promise<
  | { ok: true; result: AuditAiResult; usage: { costCents: number } }
  | { ok: false; error: string }
> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  const householdId = ctx.household.id;

  const [audit, rendimentos] = await Promise.all([
    getAuditTotals(year, householdId),
    getRendimentosReport(year, householdId),
  ]);

  // Lista de pagamentos dedutíveis (sem PII) pra IA ver os meses
  const supabase = await createClient();
  type DedRow = { kind: string; amount: number; description: string | null; created_at: string };
  const { data: deductibles } = await supabase
    .from("ir_deductible_payments")
    .select("kind, amount, description, created_at")
    .eq("year", year)
    .returns<DedRow[]>();

  // Conta pagamentos por kind pra detectar gaps (ex: plano só com 8 meses)
  const dedCountsByKind: Record<string, number> = {};
  for (const d of deductibles ?? []) {
    dedCountsByKind[d.kind] = (dedCountsByKind[d.kind] ?? 0) + 1;
  }

  // Compacta rendimentos pra prompt (só os campos relevantes)
  const tributaveisLines = rendimentos.tributaveis.rows
    .slice(0, 30)
    .map(
      (r) =>
        `${r.payerName.slice(0, 30)}|${r.grossAmount.toFixed(2)}|IRRF:${r.irrf.toFixed(2)}|INSS:${r.inss.toFixed(2)}`,
    )
    .join("\n");
  const isentosLines = rendimentos.isentos.rows
    .slice(0, 30)
    .map((r) => `${r.payerName.slice(0, 30)}|${r.grossAmount.toFixed(2)}`)
    .join("\n");
  const exclusivosLines = rendimentos.exclusivos.rows
    .slice(0, 30)
    .map((r) => `${r.payerName.slice(0, 30)}|${r.grossAmount.toFixed(2)}`)
    .join("\n");

  const userPrompt = `Ano-base: ${year} (declaração IRPF/${year + 1})

== TOTAIS DA AUDITORIA ==
Declarantes: ${audit.filerCount} | Dependentes: ${audit.dependentCount}
Rendimentos tributáveis PJ: R$ ${audit.rendimentosTributaveisPJ.toFixed(2)}
Rendimentos isentos: R$ ${audit.rendimentosIsentos.toFixed(2)}
Rendimentos exclusivos fonte: R$ ${audit.rendimentosExclusivos.toFixed(2)}
Total IRRF retido: R$ ${audit.totalIrrf.toFixed(2)}
Total INSS: R$ ${audit.totalInss.toFixed(2)}
Bens em 31/12: R$ ${audit.bensTotalAtual.toFixed(2)} (anterior: R$ ${audit.bensTotalAnterior.toFixed(2)})
Dívidas em 31/12: R$ ${audit.dividasTotalAtual.toFixed(2)} (${audit.dividasDeclarableCount} obrigatórias)
Total dedutíveis: R$ ${audit.deductiblesTotal.toFixed(2)}
Imposto modelo simples: R$ ${audit.impostoSimples.toFixed(2)}
Imposto modelo completo: R$ ${audit.impostoCompleto.toFixed(2)}
Recomendação atual: ${audit.recomendacao}

== DEDUTÍVEIS POR TIPO ==
${Object.entries(audit.deductiblesByKind)
  .map(([k, v]) => `${k}: R$ ${v.toFixed(2)} (${dedCountsByKind[k] ?? 0} lançamentos)`)
  .join("\n") || "Nenhum"}

== RENDIMENTOS TRIBUTÁVEIS (payer | bruto | IRRF | INSS) ==
${tributaveisLines || "Nenhum"}

== RENDIMENTOS ISENTOS ==
Dividendos: R$ ${rendimentos.isentos.dividends.toFixed(2)}
LCI/LCA: R$ ${rendimentos.isentos.lciLca.toFixed(2)}
Poupança: R$ ${rendimentos.isentos.poupanca.toFixed(2)}
FII rendimentos: R$ ${rendimentos.isentos.fiiRendimentos.toFixed(2)}
Outros: R$ ${rendimentos.isentos.other.toFixed(2)}
${isentosLines}

== RENDIMENTOS EXCLUSIVOS FONTE ==
Renda fixa: R$ ${rendimentos.exclusivos.rendaFixa.toFixed(2)}
JCP: R$ ${rendimentos.exclusivos.jcp.toFixed(2)}
13º salário: R$ ${rendimentos.exclusivos.thirteenth.toFixed(2)}
Outros: R$ ${rendimentos.exclusivos.other.toFixed(2)}
${exclusivosLines}

Analise e retorne JSON conforme schema. Foque nos problemas REAIS e quantifique impacto sempre que possível.`;

  const openai = getOpenAI();
  let resp;
  try {
    resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tax_audit",
          schema: z.toJSONSchema(AuditAiResultSchema, { target: "draft-7" }) as Record<
            string,
            unknown
          >,
          strict: false,
        },
      },
      max_tokens: 4_000,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Falha na OpenAI: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const content = resp.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: "Resposta da IA malformada." };
  }

  const validated = AuditAiResultSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: `Schema inválido: ${validated.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const inputTokens = resp.usage?.prompt_tokens ?? 0;
  const outputTokens = resp.usage?.completion_tokens ?? 0;

  return {
    ok: true,
    result: validated.data,
    usage: { costCents: estimateCostCents(inputTokens, outputTokens) },
  };
}
