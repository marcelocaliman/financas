import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Boleto } from "../document-types";
import { transactionDedupKey } from "../dedup";
import { computeAmountAccount } from "../currency-convert";
import type { Currency } from "@/types/database";

/**
 * Aplica boleto extraído. Dedup por chave de transação.
 */
export async function applyBoleto(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: Boleto;
  accountId: string;
  categoryId?: string | null;
}): Promise<
  | { ok: true; createdIds: string[]; skipped: boolean }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const description = `${args.data.payee_name} · ${args.data.description}`;
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
  const amountAccount = await computeAmountAccount({
    amount: args.data.amount,
    fromCurrency: docCurrency,
    accountCurrency,
    date: args.data.due_date,
  });
  const key = transactionDedupKey({
    accountId: args.accountId,
    date: args.data.due_date,
    amount: amountAccount,
    description,
  });

  // Dedup
  type ExistingBuilder = {
    select: (s: string) => {
      eq: (c: string, v: unknown) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => Promise<{ data: { id: string; description: string }[] | null }>;
        };
      };
    };
  };
  const { data: existing } = await (
    admin.from as unknown as (t: string) => ExistingBuilder
  )("transactions")
    .select("id, description")
    .eq("account_id", args.accountId)
    .eq("date", args.data.due_date)
    .eq("amount", amountAccount);
  const hit = (existing ?? []).find(
    (tx) =>
      transactionDedupKey({
        accountId: args.accountId,
        date: args.data.due_date,
        amount: amountAccount,
        description: tx.description,
      }) === key,
  );
  if (hit) {
    return { ok: true, createdIds: [], skipped: true };
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
    .insert([
      {
        household_id: args.householdId,
        created_by: args.userId,
        account_id: args.accountId,
        kind: "expense",
        date: args.data.due_date,
        description,
        amount: args.data.amount,
        amount_account: amountAccount,
        currency: docCurrency,
        category_id: args.categoryId ?? null,
        category_source: "openai",
        exclude_from_ir: false,
        is_historical_ir_only: false,
        is_recurring: false,
        metadata: {
          source: "openai_inbox",
          document_id: args.documentId,
          payee_name: args.data.payee_name,
          payee_cnpj_cpf: args.data.payee_cnpj_cpf,
          barcode: args.data.barcode,
          ...(docCurrency !== accountCurrency
            ? { original_currency: docCurrency, original_amount: args.data.amount }
            : {}),
        },
      },
    ])
    .select("id");

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao criar transação." };
  }

  return { ok: true, createdIds: inserted.map((r) => r.id), skipped: false };
}
