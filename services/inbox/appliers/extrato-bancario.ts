import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ExtratoBancario } from "../document-types";
import { applyDedupCounts, transactionDedupKey } from "../dedup";
import { computeAmountAccount } from "../currency-convert";
import type { Currency } from "@/types/database";

/**
 * Aplica extrato bancário extraído. Dedup por contagem como na fatura.
 *
 * Pula movimentos kind='transfer' e kind='fee' por default — esses precisam
 * de input humano (qual conta destino, qual categoria).
 */
export async function applyExtratoBancario(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: ExtratoBancario;
  accountId: string;
  includeKinds?: Array<"income" | "expense" | "transfer" | "fee" | "interest">;
}): Promise<
  | { ok: true; createdIds: string[]; skippedCount: number }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const allowedKinds = new Set(args.includeKinds ?? ["income", "expense", "interest"]);
  const toApply = args.data.movements.filter((m) => allowedKinds.has(m.kind));

  if (toApply.length === 0) {
    return { ok: false, error: "Nenhum movimento aplicável (todos foram filtrados)." };
  }

  // Moeda do documento (default BRL) vs moeda da conta destino
  const docCurrency = (args.data.currency ?? "BRL") as Currency;
  type AccBuilder = {
    select: (s: string) => {
      eq: (
        c: string,
        v: string,
      ) => { maybeSingle: () => Promise<{ data: { currency: Currency } | null }> };
    };
  };
  const { data: acc } = await (
    supabase.from as unknown as (t: string) => AccBuilder
  )("accounts")
    .select("currency")
    .eq("id", args.accountId)
    .maybeSingle();
  const accountCurrency = (acc?.currency ?? "BRL") as Currency;

  type Row = { payload: Record<string, unknown>; key: string };
  const rows: Row[] = await Promise.all(
    toApply.map(async (m) => {
      const isIncome =
        m.kind === "income" ||
        m.kind === "interest" ||
        (m.amount >= 0 && m.kind !== "expense" && m.kind !== "fee");
      const absAmount = Math.abs(m.amount);
      // amount fica na moeda do documento (nativa), amount_account na da conta
      const amountAccount = await computeAmountAccount({
        amount: absAmount,
        fromCurrency: docCurrency,
        accountCurrency,
        date: m.date,
      });
      return {
        payload: {
          household_id: args.householdId,
          created_by: args.userId,
          account_id: args.accountId,
          kind: isIncome ? "income" : "expense",
          date: m.date,
          description: m.description,
          amount: absAmount,
          amount_account: amountAccount,
          currency: docCurrency,
          category_source: "openai",
          exclude_from_ir: false,
          is_historical_ir_only: false,
          is_recurring: false,
          metadata: {
            source: "openai_inbox",
            document_id: args.documentId,
            bank_name: args.data.bank_name,
            original_kind: m.kind,
            ...(docCurrency !== accountCurrency
              ? { original_currency: docCurrency, original_amount: absAmount }
              : {}),
          },
        },
        key: transactionDedupKey({
          accountId: args.accountId,
          date: m.date,
          amount: amountAccount,
          description: m.description,
        }),
      };
    }),
  );

  // Busca existentes
  const dates = Array.from(new Set(rows.map((r) => r.payload.date as string))).sort();
  type ExistingBuilder = {
    select: (s: string) => {
      eq: (c: string, v: unknown) => {
        gte: (
          c: string,
          v: unknown,
        ) => {
          lte: (c: string, v: unknown) => Promise<{
            data: Array<{ date: string; amount: string | number; description: string }> | null;
          }>;
        };
      };
    };
  };
  const { data: existing } = await (
    admin.from as unknown as (t: string) => ExistingBuilder
  )("transactions")
    .select("date, amount, description")
    .eq("account_id", args.accountId)
    .gte("date", dates[0])
    .lte("date", dates[dates.length - 1]);

  const existingCounts = new Map<string, number>();
  for (const tx of existing ?? []) {
    const k = transactionDedupKey({
      accountId: args.accountId,
      date: tx.date,
      amount: Number(tx.amount),
      description: tx.description,
    });
    existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
  }

  const { toInsert, skippedCount } = applyDedupCounts(
    rows.map((r) => ({ item: r.payload, key: r.key })),
    existingCounts,
  );

  if (toInsert.length === 0) {
    return { ok: true, createdIds: [], skippedCount };
  }

  type Builder = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  const { data: inserted, error } = await (
    admin.from as unknown as (t: string) => Builder
  )("transactions")
    .insert(toInsert)
    .select("id");

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao inserir transações." };
  }

  return { ok: true, createdIds: inserted.map((r) => r.id), skippedCount };
}
