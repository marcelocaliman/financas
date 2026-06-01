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
 * Tudo que vai cair no caixa nos próximos N dias. Une duas fontes:
 *   (1) lançamentos REAIS com data futura na janela — avulsos, parcelas e
 *       recorrências já materializadas (vêm da tabela transactions);
 *   (2) recorrências ainda NÃO materializadas (projeção das regras ativas).
 * A (2) pula o que já existe como (1) — sem dupla contagem.
 *
 * Classificação cash-basis: compra no cartão não conta como Saiu; pagamento de
 * fatura (transfer p/ cartão) conta. Útil pro card "Próximos 7/30 dias" na home.
 */
export async function getUpcomingObligations(days = 7): Promise<UpcomingSummary> {
  const supabase = await createClient();
  const today = todayISO();
  const until = addDaysISO(today, days);

  const [{ data: rules }, { data: futureTxns }, displayCurrency, rates, cardIds] =
    await Promise.all([
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
      // Lançamentos REAIS com data futura dentro da janela (avulsos, parcelas,
      // recorrências já materializadas). É o que faltava: o card não pode mostrar
      // só recorrência — tem que mostrar tudo que vai cair nos próximos N dias.
      supabase
        .from("transactions")
        .select(
          `id, account_id, kind, amount, currency, description, date,
           transfer_pair_id, transfer_direction, recurring_rule_id,
           account:accounts(name,type), category:categories(name)`,
        )
        .gt("date", today)
        .lte("date", until)
        .eq("is_historical_ir_only", false)
        .order("date"),
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

  // ── (1) Lançamentos REAIS já com data futura na janela. Antes o card só lia
  // recorrências; agora mostra também avulsos/parcelas/recorrências materializadas.
  type TxAcc = { name: string; type?: string };
  type TxRow = {
    id: string;
    account_id: string | null;
    kind: "income" | "expense" | "transfer";
    amount: number | string;
    currency: Currency;
    description: string;
    date: string;
    transfer_pair_id: string | null;
    transfer_direction: "out" | "in" | null;
    recurring_rule_id: string | null;
    account: TxAcc | TxAcc[] | null;
    category: { name: string } | { name: string }[] | null;
  };
  // Chaves (regra+data) já materializadas — pra NÃO projetar a recorrência de novo.
  const materializedKeys = new Set<string>();
  // Transfer = 2 linhas (out=origem, in=destino) ligadas por transfer_pair_id.
  const transferPairs = new Map<string, { out?: TxRow; in?: TxRow }>();

  for (const t of (futureTxns ?? []) as TxRow[]) {
    if (t.recurring_rule_id) materializedKeys.add(`${t.recurring_rule_id}:${t.date}`);

    if (t.kind === "transfer" && t.transfer_pair_id) {
      const pair = transferPairs.get(t.transfer_pair_id) ?? {};
      if (t.transfer_direction === "in") pair.in = t;
      else pair.out = t;
      transferPairs.set(t.transfer_pair_id, pair);
      continue;
    }

    const acc = flatten(t.account);
    const cat = flatten(t.category);
    const amt = convertOrSame(Number(t.amount ?? 0), t.currency, displayCurrency, rates);
    items.push({
      date: t.date,
      description: t.description,
      kind: t.kind,
      amount: amt,
      ruleId: t.id,
      accountName: acc?.name ?? null,
      categoryName: cat?.name ?? null,
      fromAccountName: null,
      toAccountName: null,
    });
    if (t.kind === "income") {
      totalIncome += amt;
    } else if (t.kind === "expense") {
      const isCardExpense = t.account_id != null && cardSet.has(t.account_id);
      if (!isCardExpense) totalExpense += amt; // cash basis: compra no cartão não é Saiu
    }
  }

  for (const pair of transferPairs.values()) {
    const canonical = pair.out ?? pair.in;
    if (!canonical) continue;
    const fromAcc = flatten(pair.out?.account ?? null);
    const toAcc = flatten(pair.in?.account ?? null);
    const amt = convertOrSame(Number(canonical.amount ?? 0), canonical.currency, displayCurrency, rates);
    const toIsCard = pair.in?.account_id != null && cardSet.has(pair.in.account_id);
    items.push({
      date: canonical.date,
      description: canonical.description,
      kind: "transfer",
      amount: amt,
      ruleId: canonical.transfer_pair_id ?? canonical.id,
      accountName: null,
      categoryName: null,
      fromAccountName: fromAcc?.name ?? null,
      toAccountName: toAcc?.name ?? null,
    });
    if (toIsCard) {
      totalExpense += amt; // pagamento de fatura = cash real saindo
    } else {
      totalTransferIn += amt;
      totalTransferOut += amt;
    }
  }

  // ── (2) Recorrências ainda NÃO materializadas (projeção). ───────────────────
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
      if (materializedKeys.has(`${r.id}:${d}`)) continue; // já existe como lançamento real

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
