import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Detecta lacunas de transações retroativas pra IR.
 *
 * Pra cada recorrência ativa que começou ANTES do app_start_date do household:
 *   - Quantas ocorrências deveriam existir entre start_date e hoje (limit ano corrente)
 *   - Quantas existem como transactions (qualquer flag)
 *   - Se faltam, gap = N. Sugere materializar N meses como is_historical_ir_only=true.
 *
 * Usado pelo banner em /ir/[year] e pelo wizard.
 */

export type RetroactiveGap = {
  ruleId: string;
  description: string;
  kind: "income" | "expense" | "transfer";
  amount: number;
  startDate: string;
  /** Meses faltantes (entre start_date e mês corrente, no ano da declaração) */
  missingMonths: string[]; // ["2026-01", "2026-02", ...]
  totalMissingAmount: number;
  isDeductible: boolean;
  excludeFromIr: boolean;
};

export async function detectRetroactiveGaps(
  year: number,
): Promise<RetroactiveGap[]> {
  const supabase = await createClient();

  // Mês corrente (até onde faz sentido cadastrar retroativo)
  const todayMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [{ data: rules }, { data: txs }] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select(
        "id, description, kind, amount, start_date, end_date, is_active, frequency, day_of_month, is_tax_deductible, exclude_from_ir, ir_deductible_kind",
      )
      .eq("is_active", true)
      .in("kind", ["income", "expense"])
      .lte("start_date", yearEnd),
    supabase
      .from("transactions")
      .select("recurring_rule_id, date")
      .gte("date", yearStart)
      .lte("date", yearEnd)
      .not("recurring_rule_id", "is", null),
  ]);

  if (!rules || rules.length === 0) return [];

  // Mapa de meses já materializados por rule_id
  const materializedByRule = new Map<string, Set<string>>();
  for (const t of txs ?? []) {
    const k = (t.recurring_rule_id as string) ?? null;
    if (!k) continue;
    const month = (t.date as string).slice(0, 7);
    if (!materializedByRule.has(k)) materializedByRule.set(k, new Set());
    materializedByRule.get(k)!.add(month);
  }

  const gaps: RetroactiveGap[] = [];
  for (const rule of rules) {
    // Só considera mensal por enquanto (simplifica)
    if (rule.frequency !== "monthly") continue;

    // Calcula meses esperados entre start_date (ou início do ano) e o mês corrente
    const startMonth = (rule.start_date as string).slice(0, 7);
    const endMonth = rule.end_date
      ? (rule.end_date as string).slice(0, 7)
      : todayMonth;
    const effectiveStart = startMonth > `${year}-01` ? startMonth : `${year}-01`;
    const effectiveEnd = endMonth < todayMonth ? endMonth : todayMonth;

    const expected: string[] = [];
    let cursor = effectiveStart;
    while (cursor <= effectiveEnd) {
      expected.push(cursor);
      // Próximo mês
      const [y, m] = cursor.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      cursor = next;
    }

    const have = materializedByRule.get(rule.id as string) ?? new Set();
    const missing = expected.filter((m) => !have.has(m));

    if (missing.length > 0) {
      gaps.push({
        ruleId: rule.id as string,
        description: rule.description as string,
        kind: rule.kind as "income" | "expense" | "transfer",
        amount: Number(rule.amount),
        startDate: rule.start_date as string,
        missingMonths: missing,
        totalMissingAmount: Number(rule.amount) * missing.length,
        isDeductible: Boolean(rule.is_tax_deductible),
        excludeFromIr: Boolean(rule.exclude_from_ir),
      });
    }
  }

  return gaps.sort((a, b) => b.totalMissingAmount - a.totalMissingAmount);
}
