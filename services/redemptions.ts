import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type YieldRule = Tables<"yield_rules"> & {
  investment?: Pick<Tables<"investments">, "id" | "ticker" | "name" | "current_balance" | "account_id"> | null;
  destination?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
};

export type RedemptionIntent = Tables<"redemption_intents"> & {
  rule?: YieldRule | null;
};

export async function listYieldRules(): Promise<YieldRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("yield_rules")
    .select(
      "*, investment:investments(id,ticker,name,current_balance,account_id), destination:accounts!yield_rules_destination_account_id_fkey(id,name,institution)",
    )
    .order("day_of_month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as YieldRule[];
}

export async function ensurePendingIntents(monthsAhead = 3): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("ensure_pending_intents", { p_months_ahead: monthsAhead });
}

export async function getNextPending(): Promise<RedemptionIntent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("redemption_intents")
    .select(
      "*, rule:yield_rules(*, investment:investments(id,ticker,name,current_balance,account_id), destination:accounts!yield_rules_destination_account_id_fkey(id,name,institution))",
    )
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as RedemptionIntent) ?? null;
}

/** Lista TODOS os intents pendentes (ordenados por data). */
export async function listPendingIntents(): Promise<RedemptionIntent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("redemption_intents")
    .select(
      "*, rule:yield_rules(*, investment:investments(id,ticker,name,current_balance,account_id), destination:accounts!yield_rules_destination_account_id_fkey(id,name,institution))",
    )
    .eq("status", "pending")
    .order("due_date", { ascending: true });
  return (data ?? []) as RedemptionIntent[];
}

export async function listRedemptionHistory(limit = 12): Promise<RedemptionIntent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("redemption_intents")
    .select(
      "*, rule:yield_rules(*, investment:investments(id,ticker,name,current_balance,account_id), destination:accounts!yield_rules_destination_account_id_fkey(id,name,institution))",
    )
    .neq("status", "pending")
    .order("due_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RedemptionIntent[];
}

/**
 * Projeção de patrimônio em N anos.
 * Modelo simples: aplica taxa diária composta de Selic + multiplicador,
 * subtrai saque mensal no dia configurado.
 * Para múltiplos ativos: agrega todos os Selic + ignora os outros.
 */
export type ProjectionPoint = { month: number; balance: number; sacado: number };

export function projectFiveYears(
  initialBalance: number,
  selicAnnualPct: number,
  monthlyWithdrawal: number,
  months = 60,
): { points: ProjectionPoint[]; totalSacado: number; lastBalance: number; lastMonthYield: number } {
  const dailyRate = Math.pow(1 + selicAnnualPct / 100, 1 / 252) - 1;
  const days = 21; // ~dias úteis em um mês
  const monthlyFactor = Math.pow(1 + dailyRate, days);

  const points: ProjectionPoint[] = [{ month: 0, balance: initialBalance, sacado: 0 }];
  let balance = initialBalance;
  let sacado = 0;

  for (let m = 1; m <= months; m++) {
    balance = balance * monthlyFactor;
    balance -= monthlyWithdrawal;
    sacado += monthlyWithdrawal;
    if (balance < 0) balance = 0;
    points.push({ month: m, balance: Math.round(balance * 100) / 100, sacado });
    if (balance === 0) {
      // Mantém zerado pelos meses restantes
      for (let n = m + 1; n <= months; n++) {
        points.push({ month: n, balance: 0, sacado });
      }
      break;
    }
  }

  const last = points[points.length - 1];
  const lastMonthYield = last.balance * (monthlyFactor - 1);
  return {
    points,
    totalSacado: sacado,
    lastBalance: last.balance,
    lastMonthYield: Math.round(lastMonthYield * 100) / 100,
  };
}
