import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

// Re-exporta os labels (client-safe). Esse re-export mantém retrocompat
// pra quem importava DEBT_KIND_LABELS de "@/services/debts" antes.
export { DEBT_KIND_LABELS } from "@/lib/financial/debt-labels";

export type Debt = Tables<"debts">;

export async function listDebts(opts: { includeInactive?: boolean } = {}): Promise<Debt[]> {
  const supabase = await createClient();
  let q = supabase.from("debts").select("*").order("kind").order("creditor_name");
  if (!opts.includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

export type DebtsReport = {
  rows: Debt[];
  totalOriginal: number;
  totalCurrent: number;
  /** Dívidas com saldo > R$ 5k em 31/12 (obrigatórias declarar) */
  declarable: Debt[];
};

const DECLARABLE_THRESHOLD = 5000;

export async function getDebtsReport(householdId?: string): Promise<DebtsReport> {
  const supabase = await createClient();
  const q = supabase.from("debts").select("*").eq("is_active", true);
  const { data } = householdId ? await q.eq("household_id", householdId) : await q;
  const rows = data ?? [];
  // Saldo pode ficar negativo (pagamento a mais = crédito). Pra "quanto ainda
  // devo", clampamos em zero — uma dívida quitada/sobrepaga conta como 0.
  const remaining = (d: { current_balance: number | string }) =>
    Math.max(0, Number(d.current_balance));
  return {
    rows,
    totalOriginal: rows.reduce((s, d) => s + Number(d.original_amount), 0),
    totalCurrent: rows.reduce((s, d) => s + remaining(d), 0),
    declarable: rows.filter((d) => remaining(d) > DECLARABLE_THRESHOLD),
  };
}
