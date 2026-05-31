import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { computeNextOccurrences } from "@/services/recurrences";
import { getCreditCardAccountIds } from "@/services/credit-card";
import type { Currency, Tables } from "@/types/database";

export type UpcomingItem = {
  date: string; // YYYY-MM-DD
  description: string;
  kind: "income" | "expense" | "transfer";
  amount: number; // já em displayCurrency
  ruleId: string;
  accountName: string | null;
  categoryName: string | null;
  fromAccountName: string | null;
  toAccountName: string | null;
};

export type UpcomingSummary = {
  items: UpcomingItem[];
  totalIncome: number;
  totalExpense: number;
  totalTransferOut: number;
  totalTransferIn: number;
  displayCurrency: Currency;
};

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Próximas obrigações nos próximos N dias, baseadas nas regras recorrentes
 * ativas. Considera apenas ocorrências AINDA NÃO materializadas
 * (date > last_materialized_date).
 *
 * Útil pro card "Próximos 7/30 dias" na home, mostrando o que vai cair
 * no caixa.
 */
export async function getUpcomingObligations(days = 7): Promise<UpcomingSummary> {
  const supabase = await createClient();
  const today = todayISO();
  const until = addDaysISO(today, days);

  const [{ data: rules }, displayCurrency, rates, cardIds] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select(
        `id, account_id, from_account_id, to_account_id, amount, currency, kind, description,
         start_date, end_date, frequency, interval_count, day_of_month, day_of_week,
         last_materialized_date,
         account:accounts!recurring_rules_account_id_fkey(name,type),
         from_account:accounts!recurring_rules_from_account_id_fkey(name),
         to_account:accounts!recurring_rules_to_account_id_fkey(name,type),
         category:categories(name)`,
      )
      .eq("is_active", true),
    getDisplayCurrency(),
    getRateMap(),
    getCreditCardAccountIds(),
  ]);
  const cardSet = new Set(cardIds);

  const items: UpcomingItem[] = [];
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransferIn = 0;
  let totalTransferOut = 0;

  type RuleRow = Pick<
    Tables<"recurring_rules">,
    | "id"
    | "account_id"
    | "from_account_id"
    | "to_account_id"
    | "amount"
    | "currency"
    | "kind"
    | "description"
    | "start_date"
    | "end_date"
    | "frequency"
    | "interval_count"
    | "day_of_month"
    | "day_of_week"
    | "last_materialized_date"
  > & {
    account: { name: string; type?: string } | { name: string; type?: string }[] | null;
    from_account: { name: string } | { name: string }[] | null;
    to_account: { name: string; type?: string } | { name: string; type?: string }[] | null;
    category: { name: string } | { name: string }[] | null;
  };
  const flatten = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v);

  for (const r of (rules ?? []) as RuleRow[]) {
    // Pega as próximas datas a partir de hoje. computeNextOccurrences usa
    // start_date como ancoragem, então funciona bem.
    // Overshoot dimensionado pela janela: uma regra diária gera ~`days`
    // ocorrências dentro dela. O cap fixo de 10 cortava silenciosamente
    // recorrências diárias em janelas >= ~10 dias.
    const occurrences = computeNextOccurrences(r, today, days + 2); // filtra abaixo por `until`
    const amountConverted = convertOrSame(
      Number(r.amount ?? 0),
      r.currency,
      displayCurrency,
      rates,
    );
    const matCutoff = r.last_materialized_date ?? "1900-01-01";

    // Cash basis: regra de expense num cartão não conta como Saiu projetado.
    // Regra de transfer cujo destino é cartão (pagamento de fatura) SIM conta.
    const isCardExpense =
      r.kind === "expense" && r.account_id != null && cardSet.has(r.account_id);
    const isBillPayment =
      r.kind === "transfer" && r.to_account_id != null && cardSet.has(r.to_account_id);

    for (const d of occurrences) {
      if (d > until) break;
      if (d <= matCutoff) continue; // já foi materializada

      const acc = flatten(r.account);
      const fromAcc = flatten(r.from_account);
      const toAcc = flatten(r.to_account);
      const cat = flatten(r.category);

      items.push({
        date: d,
        description: r.description,
        kind: r.kind,
        amount: amountConverted,
        ruleId: r.id,
        accountName: acc?.name ?? null,
        categoryName: cat?.name ?? null,
        fromAccountName: fromAcc?.name ?? null,
        toAccountName: toAcc?.name ?? null,
      });

      if (r.kind === "income") {
        totalIncome += amountConverted;
      } else if (r.kind === "expense") {
        if (!isCardExpense) totalExpense += amountConverted;
      } else if (r.kind === "transfer") {
        if (isBillPayment) {
          totalExpense += amountConverted; // pagamento de fatura = cash real saindo
        } else {
          totalTransferIn += amountConverted;
          totalTransferOut += amountConverted;
        }
      }
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  return {
    items,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    totalTransferIn: Math.round(totalTransferIn * 100) / 100,
    totalTransferOut: Math.round(totalTransferOut * 100) / 100,
    displayCurrency,
  };
}
