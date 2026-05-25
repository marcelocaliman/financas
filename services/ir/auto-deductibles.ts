import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import type { Currency, IRDeductibleKind, Tables } from "@/types/database";

/**
 * Auto-detecção e importação de pagamentos dedutíveis a partir de transações
 * e recorrências do usuário.
 *
 * Estratégia em camadas:
 *   1. Categoria com ir_deductible_kind explícito → usa
 *   2. Recurring rule com is_tax_deductible=true → usa kind dela
 *   3. Match por nome com known_institutions (CNPJ catalog) → usa kind
 *   4. Match por keywords (saúde, médico, dentista) na descrição → infere
 */

export type DeductibleCandidate = {
  transactionId: string;
  date: string;
  description: string;
  amount: number; // BRL
  currency: Currency;
  categoryName: string | null;
  /** Tipo dedutível inferido — null se nada bateu */
  suggestedKind: IRDeductibleKind | null;
  /** CNPJ da instituição reconhecida no catálogo */
  recognizedCnpj: string | null;
  /** Nome canônico da instituição (do catálogo) */
  recognizedName: string | null;
  /** Confiança da sugestão: high (categoria explícita / catálogo CNPJ),
   *  medium (keyword na descrição), low (heurística fraca) */
  confidence: "high" | "medium" | "low";
  /** Indica se já existe pagamento dedutível pra essa transação */
  alreadyImported: boolean;
};

const KEYWORD_MAP: Array<{
  patterns: RegExp;
  kind: IRDeductibleKind;
  confidence: "medium" | "low";
}> = [
  { patterns: /\b(unimed|amil|bradesco saude|sulamerica|hapvida|notredame|porto saude|porto seguro saude|notredame intermedica|prevent senior|gndi|seguros saude|plano de saude|plano saude)\b/i, kind: "plano_saude", confidence: "medium" },
  { patterns: /\b(hospital|clinica|santa casa|sirio libanes|albert einstein|hcor|oswaldo cruz|9 de julho|rede d'?or|sao luiz)\b/i, kind: "hospital", confidence: "medium" },
  { patterns: /\b(consulta medica|consulta com dr|dra |dr\.|medico|cardiologista|dermatologista|ginecologista|ortopedista|pediatra|otorrino|psiquiatra|oftalmo|urologista)\b/i, kind: "medico", confidence: "medium" },
  { patterns: /\b(dentista|odontologica|odontologia|ortodontia|implante dental)\b/i, kind: "dentista", confidence: "medium" },
  { patterns: /\b(psicolog|psicoterapia|terapia|analista)\b/i, kind: "psicologo", confidence: "medium" },
  { patterns: /\b(laboratorio|fleury|dasa|delboni|alta diagnosticos|sabin|exame medico|exames|raio.x|tomografia|ressonancia|ultrassom)\b/i, kind: "hospital", confidence: "medium" },
  { patterns: /\b(escola|colegio|faculdade|universidade|usp|unicamp|fgv|insper|puc|mackenzie|estacio|unip|anhanguera|kroton|cogna|mensalidade escolar|mensalidade da escola|mensalidade da faculdade)\b/i, kind: "educacao_titular", confidence: "low" }, // low pq pode ser titular ou dependente
  { patterns: /\b(inss)\b/i, kind: "inss_titular", confidence: "medium" },
  { patterns: /\b(pgbl|previdencia privada|brasilprev|icatu|previdencia|previdência)\b/i, kind: "pgbl", confidence: "medium" },
  { patterns: /\b(pensao alimenticia|pensão alimentícia)\b/i, kind: "pensao_alimenticia", confidence: "medium" },
];

async function loadKnownInstitutions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("known_institutions")
    .select("cnpj, name, name_patterns, ir_deductible_kind")
    .eq("is_active", true)
    .not("ir_deductible_kind", "is", null);
  return data ?? [];
}

function matchInstitution(
  description: string,
  institutions: Awaited<ReturnType<typeof loadKnownInstitutions>>,
) {
  const desc = description.toLowerCase();
  for (const inst of institutions) {
    for (const pat of inst.name_patterns ?? []) {
      if (desc.includes(pat.toLowerCase())) {
        return inst;
      }
    }
  }
  return null;
}

function matchKeywords(description: string): {
  kind: IRDeductibleKind;
  confidence: "medium" | "low";
} | null {
  for (const m of KEYWORD_MAP) {
    if (m.patterns.test(description)) return { kind: m.kind, confidence: m.confidence };
  }
  return null;
}

/**
 * Varre transações de despesa do ano e retorna candidatos a dedução IR,
 * com sugestão de tipo + confiança + flag "já importado".
 */
export async function findDeductibleCandidates(
  year: number,
  householdId?: string,
): Promise<DeductibleCandidate[]> {
  const supabase = await createClient();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const [rates, institutions] = await Promise.all([
    getRateMapAt(yearEnd),
    loadKnownInstitutions(),
  ]);

  // 1. Busca transações de despesa do ano + categorias dedutíveis
  let txQuery = supabase
    .from("transactions")
    .select(
      "id, description, amount_account, currency, date, category:categories(name, ir_deductible_kind)",
    )
    .gte("date", yearStart)
    .lte("date", yearEnd)
    .eq("kind", "expense")
    .eq("exclude_from_ir", false);
  if (householdId) txQuery = txQuery.eq("household_id", householdId);
  const { data: txs } = await txQuery;

  // 2. Busca pagamentos já existentes pra evitar duplicar
  let payQuery = supabase
    .from("ir_deductible_payments")
    .select("transaction_id")
    .eq("year", year)
    .not("transaction_id", "is", null);
  if (householdId) payQuery = payQuery.eq("household_id", householdId);
  const { data: existing } = await payQuery;
  const importedTxIds = new Set(
    (existing ?? []).map((e) => e.transaction_id).filter(Boolean) as string[],
  );

  type TxRow = {
    id: string;
    description: string;
    amount_account: number;
    currency: Currency;
    date: string;
    category:
      | { name: string; ir_deductible_kind: IRDeductibleKind | null }
      | { name: string; ir_deductible_kind: IRDeductibleKind | null }[]
      | null;
  };

  const candidates: DeductibleCandidate[] = [];

  for (const t of (txs ?? []) as TxRow[]) {
    const cat = Array.isArray(t.category) ? t.category[0] : t.category;
    const amount = convertOrSame(
      Number(t.amount_account ?? 0),
      t.currency,
      "BRL",
      rates,
    );

    // Camada 1: categoria já é dedutível
    let suggested: IRDeductibleKind | null = cat?.ir_deductible_kind ?? null;
    let confidence: "high" | "medium" | "low" = suggested ? "high" : "low";
    let recognizedCnpj: string | null = null;
    let recognizedName: string | null = null;

    // Camada 2: matching no catálogo de CNPJs conhecidos
    if (!suggested) {
      const inst = matchInstitution(t.description, institutions);
      if (inst && inst.ir_deductible_kind) {
        suggested = inst.ir_deductible_kind as IRDeductibleKind;
        confidence = "high";
        recognizedCnpj = inst.cnpj;
        recognizedName = inst.name;
      }
    }

    // Camada 3: keywords
    if (!suggested) {
      const m = matchKeywords(t.description);
      if (m) {
        suggested = m.kind;
        confidence = m.confidence;
      }
    }

    if (!suggested) continue;

    candidates.push({
      transactionId: t.id,
      date: t.date,
      description: t.description,
      amount: Math.round(amount * 100) / 100,
      currency: t.currency,
      categoryName: cat?.name ?? null,
      suggestedKind: suggested,
      recognizedCnpj,
      recognizedName,
      confidence,
      alreadyImported: importedTxIds.has(t.id),
    });
  }

  // Ordena: não-importados primeiro, depois por confiança desc, depois data
  candidates.sort((a, b) => {
    if (a.alreadyImported !== b.alreadyImported) return a.alreadyImported ? 1 : -1;
    const order = { high: 0, medium: 1, low: 2 };
    if (order[a.confidence] !== order[b.confidence]) {
      return order[a.confidence] - order[b.confidence];
    }
    return a.date.localeCompare(b.date);
  });

  return candidates;
}

/**
 * Importa lote de candidatos como ir_deductible_payments.
 * Idempotente: pula transactionIds que já foram importados.
 */
export async function importDeductiblesBatch(args: {
  year: number;
  candidates: DeductibleCandidate[];
  householdId: string;
}): Promise<{ created: number; skipped: number }> {
  const supabase = await createClient();
  const toCreate = args.candidates
    .filter((c) => !c.alreadyImported && c.suggestedKind)
    .map((c) => ({
      household_id: args.householdId,
      year: args.year,
      kind: c.suggestedKind as IRDeductibleKind,
      description: c.description,
      recipient_name: c.recognizedName ?? c.description,
      recipient_cnpj_cpf: c.recognizedCnpj,
      amount: c.amount,
      currency: "BRL" as Currency,
      payment_date: c.date,
      transaction_id: c.transactionId,
      auto_imported: true,
      is_dependent_payment: false,
    }));

  if (toCreate.length === 0) return { created: 0, skipped: args.candidates.length };

  const { error, data } = await supabase
    .from("ir_deductible_payments")
    .insert(toCreate)
    .select("id");
  if (error) throw error;
  return {
    created: data?.length ?? 0,
    skipped: args.candidates.length - (data?.length ?? 0),
  };
}
