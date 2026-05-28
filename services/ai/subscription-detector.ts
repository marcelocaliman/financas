import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOpenAI, OPENAI_MODEL, estimateCostCents } from "@/lib/openai/client";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Detector de assinaturas zumbis via IA.
 *
 * Passa transações de despesa dos últimos 6 meses pro modelo, que detecta
 * padrões de recorrência (mesmo merchant, intervalo regular, valor estável)
 * E sugere as que merecem virar recurring_rule no app.
 *
 * Vantagem vs detecção por regex/aggregation: pega casos não-óbvios
 * (mesma assinatura cobrada em datas/valores ligeiramente diferentes por
 * IOF/spread, merchant escrito de forma inconsistente, etc.).
 */

const DetectedSubscriptionSchema = z.object({
  merchant_name: z
    .string()
    .describe("Nome do estabelecimento/serviço (limpo, sem código/lixo)"),
  description_pattern: z
    .string()
    .describe(
      "Como aparece na descrição original (pra você reconhecer ao revisar)",
    ),
  amount_average: z.number().describe("Valor médio das cobranças"),
  amount_variance: z
    .number()
    .describe(
      "Variação entre cobranças (0 = sempre igual, 0.1 = até 10% de diferença)",
    ),
  frequency: z
    .enum(["monthly", "weekly", "quarterly", "yearly", "irregular"])
    .describe("Cadência detectada"),
  day_of_month: z
    .number()
    .nullable()
    .describe("Dia do mês típico se for monthly (1-31)"),
  occurrences_count: z
    .number()
    .describe("Quantas cobranças foram identificadas no período"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "Confiança na detecção: high = óbvio assinatura, medium = padrão plausível, low = pode ser coincidência",
    ),
  reasoning: z
    .string()
    .describe("1-2 frases explicando por que considera assinatura"),
  suggested_category: z
    .string()
    .nullable()
    .describe(
      "Categoria sugerida (Streaming/Software/Telecom/etc.), null se não souber",
    ),
});

const DetectionResultSchema = z.object({
  subscriptions: z.array(DetectedSubscriptionSchema),
  summary: z
    .string()
    .describe(
      "1-2 frases de resumo: quantas detectou, valor total mensal, principal achado",
    ),
});

export type DetectedSubscription = z.infer<typeof DetectedSubscriptionSchema>;
export type DetectionResult = z.infer<typeof DetectionResultSchema>;

const SYSTEM_PROMPT = `Você é um analista de gastos financeiros brasileiros. Recebe um
extrato de transações dos últimos 6 meses e identifica ASSINATURAS recorrentes
não cadastradas (cobranças repetitivas que viram esquecidas no cartão).

CRITÉRIOS pra considerar assinatura:
- Mesmo merchant cobrado 3+ vezes em meses diferentes
- Valor estável (±10% — variação maior pode ser IOF/spread em assinatura internacional)
- Intervalo regular (monthly mais comum, weekly e yearly possíveis)
- Descrições podem variar ligeiramente: "HOSTINGER", "HOSTINGER.COM", "HOSTINGER* HOSTINGER.C" — agrupe.

IGNORAR:
- Compras óbvias (mercado, restaurante, posto): podem repetir mas não são assinatura
- Reembolsos/estornos
- Pagamentos de fatura

Pra cada padrão detectado, retorne JSON conforme schema. Seja conservador:
high confidence só pra casos óbvios. Se em dúvida, marque medium ou low.

Retorne SOMENTE JSON, sem markdown.`;

/**
 * Roda a detecção. Apenas user comum (não admin) — usa RLS pra escopo.
 */
export async function detectSubscriptions(): Promise<
  | { ok: true; result: DetectionResult; usage: { costCents: number } }
  | { ok: false; error: string }
> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  const supabase = await createClient();

  // 6 meses pra trás
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  type TxRow = {
    date: string;
    description: string;
    amount_account: number;
  };
  const { data: txs } = await supabase
    .from("transactions")
    .select("date, description, amount_account")
    .eq("kind", "expense")
    .gte("date", startDate)
    .lte("date", today)
    .order("date", { ascending: true })
    .returns<TxRow[]>();

  if (!txs || txs.length < 10) {
    return {
      ok: false,
      error: "Histórico insuficiente. Precisamos de pelo menos 10 transações nos últimos 6 meses.",
    };
  }

  // Filtra transações já marcadas como subscription (vinculadas a recurring_rule)
  // pra não sugerir o que já está cadastrado
  type ExistingSubs = { description: string };
  const { data: existingSubs } = await supabase
    .from("recurring_rules")
    .select("description")
    .contains("tags", ["subscription"])
    .returns<ExistingSubs[]>();

  const existingPatterns = new Set(
    (existingSubs ?? []).map((s) => normalizeForMatch(s.description)),
  );

  // Reduz pra texto que cabe no prompt — máx 500 linhas mais relevantes
  const filtered = txs.filter(
    (t) => !existingPatterns.has(normalizeForMatch(t.description)),
  );

  if (filtered.length < 10) {
    return {
      ok: false,
      error: "Todas as suas recorrências já parecem estar mapeadas. Nada novo a detectar.",
    };
  }

  // Compacta pra prompt — só campos essenciais
  const txLines = filtered
    .slice(-500) // últimas 500 se passar disso
    .map(
      (t) =>
        `${t.date}|${t.description.slice(0, 50)}|${Number(t.amount_account).toFixed(2)}`,
    )
    .join("\n");

  const userPrompt = `Transações de despesa dos últimos 6 meses (formato data|descrição|valor):

${txLines}

Detecte assinaturas recorrentes não óbvias. Retorne JSON conforme schema.`;

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
          name: "detection_result",
          schema: z.toJSONSchema(DetectionResultSchema, { target: "draft-7" }) as Record<
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

  const validated = DetectionResultSchema.safeParse(parsed);
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

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}
