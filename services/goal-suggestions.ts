import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { Currency, Tables } from "@/types/database";

/**
 * Detecta transferências recentes que parecem ser aportes em alguma meta,
 * mas que ainda não foram registradas como goal_contribution.
 *
 * Heurística:
 *   1. Pega transferências dos últimos 7 dias (kind='transfer', direction='in')
 *   2. Para cada uma, checa se a conta de destino é fonte de alguma meta
 *      (via goal_sources) OU se é a linked_account_id de uma meta
 *   3. Se sim, e o amount bate (±20%) com:
 *      - allocation_value da meta (modo fixed_amount), OU
 *      - target_amount × 5% (regra de ouro pra aportes mensais), OU
 *      - é uma transferência grande (> R$ 200)
 *      → vira candidate
 *   4. Se já existe goal_contribution com mesmo transaction_id, ignora
 *
 * Usado pelo /dashboard pra mostrar um "Smart suggest" banner:
 *   "Você fez uma transferência de R$ 2.500 pra Itaú Conjunta dia 15.
 *    Registrar como aporte na Casa Itália?"
 */

export type AportSuggestion = {
  transactionId: string;
  transactionDate: string;
  transactionAmount: number;
  transactionCurrency: Currency;
  transactionDescription: string;
  destAccountName: string;
  goalId: string;
  goalName: string;
  goalCurrency: Currency;
  /** Score 0..1 — quão confiante o sistema está */
  confidence: number;
  /** Razão pra exibir ao usuário */
  reason: string;
};

const DAYS_LOOKBACK = 7;
const MIN_AMOUNT_BRL = 200;

export async function getAportSuggestions(): Promise<AportSuggestion[]> {
  const supabase = await createClient();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - DAYS_LOOKBACK);
  const sinceISO = since.toISOString().slice(0, 10);

  const [
    { data: transfers },
    { data: goals },
    { data: sources },
    { data: existingContribs },
    displayCurrency,
    rates,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, account_id, date, amount, amount_account, currency, description, transfer_direction, account:accounts(name, currency)",
      )
      .eq("kind", "transfer")
      .eq("transfer_direction", "in")
      .eq("is_historical_ir_only", false)
      .gte("date", sinceISO),
    supabase
      .from("goals")
      .select("id, name, target_amount, currency, allocation_mode, allocation_value, linked_account_id")
      .eq("is_archived", false),
    supabase
      .from("goal_sources")
      .select("goal_id, source_type, source_id")
      .eq("source_type", "account"),
    supabase
      .from("goal_contributions")
      .select("transaction_id")
      .not("transaction_id", "is", null)
      .gte("date", sinceISO),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  // Mapa account_id → goals que tem essa conta como fonte ou linkedAccount
  const goalsByAccount = new Map<string, Array<Tables<"goals">>>();
  type GoalSlim = Pick<
    Tables<"goals">,
    "id" | "name" | "target_amount" | "currency" | "allocation_mode" | "allocation_value" | "linked_account_id"
  >;
  const goalsArr = (goals ?? []) as GoalSlim[];

  for (const g of goalsArr) {
    if (g.linked_account_id) {
      const arr = goalsByAccount.get(g.linked_account_id) ?? [];
      arr.push(g as unknown as Tables<"goals">);
      goalsByAccount.set(g.linked_account_id, arr);
    }
  }
  for (const s of (sources ?? []) as { goal_id: string; source_id: string | null }[]) {
    if (!s.source_id) continue;
    const goal = goalsArr.find((g) => g.id === s.goal_id);
    if (!goal) continue;
    const arr = goalsByAccount.get(s.source_id) ?? [];
    if (!arr.find((g) => g.id === goal.id)) {
      arr.push(goal as unknown as Tables<"goals">);
      goalsByAccount.set(s.source_id, arr);
    }
  }

  const usedTxnIds = new Set<string>(
    (existingContribs ?? [])
      .map((c) => c.transaction_id)
      .filter((id): id is string => id != null),
  );

  const suggestions: AportSuggestion[] = [];

  type TxnRow = {
    id: string;
    account_id: string;
    date: string;
    amount: number;
    amount_account: number;
    currency: Currency;
    description: string;
    transfer_direction: "in" | "out" | null;
    account: { name: string; currency: Currency } | { name: string; currency: Currency }[] | null;
  };

  for (const t of (transfers ?? []) as TxnRow[]) {
    if (usedTxnIds.has(t.id)) continue;

    const accountGoals = goalsByAccount.get(t.account_id);
    if (!accountGoals || accountGoals.length === 0) continue;

    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    if (!acc) continue;
    const accCurrency = (acc.currency ?? "BRL") as Currency;
    const amountInDisplay = convertOrSame(
      Number(t.amount_account ?? 0),
      accCurrency,
      displayCurrency,
      rates,
    );

    // Threshold mínimo
    if (amountInDisplay < MIN_AMOUNT_BRL) continue;

    for (const g of accountGoals) {
      const goalCurrency = g.currency;
      const amountInGoal = convertOrSame(
        Number(t.amount_account ?? 0),
        accCurrency,
        goalCurrency,
        rates,
      );

      // Calcula confidence baseado em quão bem o amount bate com expected
      let confidence = 0.5; // baseline pra estar na conta linkada
      let reason = "vai pra conta vinculada a essa meta";

      if (g.allocation_mode === "fixed_amount" && g.allocation_value) {
        const expected = Number(g.allocation_value);
        const ratio = amountInGoal / expected;
        if (ratio >= 0.8 && ratio <= 1.2) {
          confidence = 0.9;
          reason = `valor (~${Math.round((ratio * 100))}%) bate com o aporte mensal configurado`;
        }
      } else if (g.allocation_mode === "percentage") {
        confidence = 0.65;
        reason = "valor compatível com aporte mensal proporcional";
      }

      // Bonus se a descrição menciona o nome da meta (palavra-chave)
      const desc = t.description.toLowerCase();
      const goalNameLower = g.name.toLowerCase();
      const goalFirstWord = goalNameLower.split(" ")[0];
      if (
        goalFirstWord.length >= 4 &&
        (desc.includes(goalNameLower) || desc.includes(goalFirstWord))
      ) {
        confidence = Math.min(1, confidence + 0.2);
        reason += ` · descrição menciona "${goalFirstWord}"`;
      }

      suggestions.push({
        transactionId: t.id,
        transactionDate: t.date,
        transactionAmount: Number(t.amount_account),
        transactionCurrency: accCurrency,
        transactionDescription: t.description,
        destAccountName: acc.name,
        goalId: g.id,
        goalName: g.name,
        goalCurrency,
        confidence: Math.round(confidence * 100) / 100,
        reason,
      });
    }
  }

  // Ordena por confidence desc, limita a 5 sugestões
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
