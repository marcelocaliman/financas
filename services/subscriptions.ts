import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { computeNextOccurrences, toMonthlyEquivalent } from "@/services/recurrences";
import type { Tables } from "@/types/database";

/**
 * Assinaturas = recurring_rules taggeadas como 'subscription'.
 *
 * A migration auto-classificou regras com keywords conhecidas (Netflix,
 * Spotify, gym, Adobe, etc). Usuário pode adicionar/remover tag pelo UI
 * (botão de "marcar como assinatura").
 *
 * Frequency suportadas: 'monthly' e 'yearly' são as típicas; 'weekly'
 * tb rola (academia paga semanal). 'daily' não.
 */

export type Subscription = Tables<"recurring_rules"> & {
  account?: { name: string; institution: string } | null;
  category?: { name: string; color: string | null; icon: string | null } | null;
  /** Custo mensal equivalente em moeda nativa */
  monthlyEquivalent: number;
  /** Custo anual = monthly × 12, em moeda nativa */
  yearlyEquivalent: number;
  /** Custo mensal em displayCurrency */
  monthlyInDisplay: number;
  /** Custo anual em displayCurrency */
  yearlyInDisplay: number;
  /** Valor REAL que será debitado na próxima cobrança (em displayCurrency), sem
   *  normalizar pra mensal. Pra anual de R$120/ano isso é 120, não ~10. */
  chargeAmountInDisplay: number;
  /** Próxima cobrança ISO YYYY-MM-DD */
  nextChargeDate: string | null;
  /** Dias até próxima cobrança (negativo = atrasada) */
  daysUntilNextCharge: number | null;
};

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const supabase = await createClient();
  const [{ data }, displayCurrency, rates] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select(
        `*,
         account:accounts!recurring_rules_account_id_fkey(name,institution),
         category:categories(name,color,icon)`,
      )
      .eq("kind", "expense")
      .eq("is_active", true)
      .contains("tags", ["subscription"]),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  const today = todayISO();
  const subs: Subscription[] = [];

  for (const r of (data ?? []) as Subscription[]) {
    const monthly = toMonthlyEquivalent(Number(r.amount), r.frequency, r.interval_count);
    const yearly = monthly * 12;
    const monthlyInDisplay = convertOrSame(monthly, r.currency, displayCurrency, rates);
    const yearlyInDisplay = monthlyInDisplay * 12;

    const next = computeNextOccurrences(r, today, 1)[0] ?? null;
    const daysUntil = next ? diffDays(today, next) : null;

    subs.push({
      ...r,
      monthlyEquivalent: Math.round(monthly * 100) / 100,
      yearlyEquivalent: Math.round(yearly * 100) / 100,
      monthlyInDisplay: Math.round(monthlyInDisplay * 100) / 100,
      yearlyInDisplay: Math.round(yearlyInDisplay * 100) / 100,
      chargeAmountInDisplay:
        Math.round(convertOrSame(Number(r.amount), r.currency, displayCurrency, rates) * 100) /
        100,
      nextChargeDate: next,
      daysUntilNextCharge: daysUntil,
    });
  }

  // Ordena por maior custo mensal (em display) — pra encontrar os "gordurosos"
  subs.sort((a, b) => b.monthlyInDisplay - a.monthlyInDisplay);
  return subs;
}

export type SubscriptionsSummary = {
  count: number;
  monthlyTotal: number; // em displayCurrency
  yearlyTotal: number;
  nextCharge: { date: string; description: string; amount: number } | null;
  /** Top 3 mais caras */
  topExpensive: Array<{ description: string; monthly: number; yearly: number }>;
};

export async function getSubscriptionsSummary(): Promise<SubscriptionsSummary> {
  const subs = await listSubscriptions();
  const monthlyTotal = subs.reduce((s, x) => s + x.monthlyInDisplay, 0);
  const yearlyTotal = monthlyTotal * 12;

  // Próxima cobrança (entre as ativas, a com daysUntil >= 0 mais próxima)
  const nextSub = subs
    .filter((s) => s.daysUntilNextCharge != null && s.daysUntilNextCharge >= 0)
    .sort((a, b) => (a.daysUntilNextCharge ?? 0) - (b.daysUntilNextCharge ?? 0))[0];
  const nextCharge = nextSub
    ? {
        date: nextSub.nextChargeDate!,
        description: nextSub.description,
        // valor REAL da cobrança, não o equivalente mensal
        amount: nextSub.chargeAmountInDisplay,
      }
    : null;

  return {
    count: subs.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    nextCharge,
    topExpensive: subs.slice(0, 3).map((s) => ({
      description: s.description,
      monthly: s.monthlyInDisplay,
      yearly: s.yearlyInDisplay,
    })),
  };
}
