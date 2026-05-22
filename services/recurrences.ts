import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type RecurrenceRule = Tables<"recurring_rules"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
  from_account?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
  to_account?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
  category?: Pick<Tables<"categories">, "id" | "name" | "color" | "icon"> | null;
};

export async function listRecurringRules(opts?: {
  includeInactive?: boolean;
}): Promise<RecurrenceRule[]> {
  const supabase = await createClient();
  let q = supabase
    .from("recurring_rules")
    .select(
      "*, account:accounts!recurring_rules_account_id_fkey(id,name,institution), from_account:accounts!recurring_rules_from_account_id_fkey(id,name,institution), to_account:accounts!recurring_rules_to_account_id_fkey(id,name,institution), category:categories(id,name,color,icon)",
    )
    .order("is_active", { ascending: false })
    .order("start_date", { ascending: false });
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RecurrenceRule[];
}

export async function getRecurringRule(id: string): Promise<RecurrenceRule | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_rules")
    .select(
      "*, account:accounts!recurring_rules_account_id_fkey(id,name,institution), from_account:accounts!recurring_rules_from_account_id_fkey(id,name,institution), to_account:accounts!recurring_rules_to_account_id_fkey(id,name,institution), category:categories(id,name,color,icon)",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as RecurrenceRule) ?? null;
}

/**
 * Calcula até `count` próximas datas de ocorrência a partir de `fromISO`,
 * respeitando end_date. Espelha a lógica de next_recurrence_date do Postgres.
 *
 * Útil pra mostrar "próximas 3" no card sem ter que materializar nada.
 */
export function computeNextOccurrences(
  rule: Pick<
    Tables<"recurring_rules">,
    "start_date" | "frequency" | "interval_count" | "day_of_month" | "day_of_week" | "end_date"
  >,
  fromISO: string,
  count = 3,
): string[] {
  const out: string[] = [];
  const start = new Date(rule.start_date + "T00:00:00Z");
  const end = rule.end_date ? new Date(rule.end_date + "T00:00:00Z") : null;
  const fromDate = new Date(fromISO + "T00:00:00Z");
  let cursor = nextFrom(rule, fromDate, start);
  while (cursor && out.length < count) {
    if (end && cursor > end) break;
    out.push(cursor.toISOString().slice(0, 10));
    cursor = nextFrom(rule, addDays(cursor, 1), start);
  }
  return out;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/**
 * Normaliza o valor da regra pra "equivalente mensal" — útil pra somar
 * regras de freq mista. Aproximações:
 *  - daily      → ×30 / interval
 *  - weekly     → ×4.33 / interval
 *  - monthly    → ÷ interval
 *  - yearly     → ÷12 / interval
 */
export function toMonthlyEquivalent(
  amount: number,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  intervalCount: number,
): number {
  const interval = Math.max(1, intervalCount);
  switch (frequency) {
    case "daily":
      return (amount * 30) / interval;
    case "weekly":
      return (amount * 4.33) / interval;
    case "monthly":
      return amount / interval;
    case "yearly":
      return amount / 12 / interval;
  }
}

function nextFrom(
  rule: Pick<
    Tables<"recurring_rules">,
    "start_date" | "frequency" | "interval_count" | "day_of_month" | "day_of_week"
  >,
  from: Date,
  start: Date,
): Date | null {
  if (from <= start) return start;
  const interval = Math.max(1, rule.interval_count);
  switch (rule.frequency) {
    case "daily": {
      const diff = Math.ceil((from.getTime() - start.getTime()) / 86400000);
      const steps = Math.ceil(diff / interval);
      return addDays(start, steps * interval);
    }
    case "weekly": {
      const diff = Math.ceil((from.getTime() - start.getTime()) / 86400000);
      const steps = Math.ceil(diff / (7 * interval));
      return addDays(start, steps * 7 * interval);
    }
    case "monthly": {
      const anchor = rule.day_of_month ?? start.getUTCDate();
      let cursor = new Date(start);
      while (cursor < from) {
        const m = cursor.getUTCMonth();
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), m + interval, 1));
        // último dia se anchor > dias do mês
        const lastDay = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
        ).getUTCDate();
        cursor.setUTCDate(Math.min(anchor, lastDay));
      }
      return cursor;
    }
    case "yearly": {
      let cursor = new Date(start);
      while (cursor < from) {
        cursor = new Date(
          Date.UTC(cursor.getUTCFullYear() + interval, cursor.getUTCMonth(), cursor.getUTCDate()),
        );
      }
      return cursor;
    }
  }
}
