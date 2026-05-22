"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { getRateMap } from "@/services/currency";
import { convertOrSame } from "@/lib/financial/currency";
import type { Currency, PaymentMethod, TransactionKind } from "@/types/database";

/**
 * Linha do CSV depois de parseada (lib/utils/csv.ts faz o parse cru;
 * aqui recebemos os campos já mapeados).
 */
export type ImportRow = {
  date: string; // ISO YYYY-MM-DD
  description: string;
  amount: number;
  currency: Currency;
  kind: TransactionKind;
  accountName: string;
  categoryName?: string | null;
  paymentMethod?: PaymentMethod | null;
};

export type ImportResult = {
  ok?: boolean;
  inserted?: number;
  errors?: Array<{ index: number; error: string }>;
};

/**
 * Importa N transações em batch. Match de conta/categoria por nome
 * case-insensitive. Estratégia all-or-nothing: se uma linha tem problema
 * (conta inexistente, valor inválido, etc.), aborta tudo.
 *
 * Não suporta transfer no MVP — transfer precisa de 2 contas + RPC, e
 * a UX de CSV pra transfer fica esquisita (qual linha é qual ponta?).
 * Se vier kind=transfer, retorna erro pedindo pra usar /recorrentes.
 */
export async function importTransactionsCSV(rows: ImportRow[]): Promise<ImportResult> {
  if (rows.length === 0) return { errors: [{ index: -1, error: "Nenhuma linha pra importar." }] };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { errors: [{ index: -1, error: "Sessão expirada." }] };

  const supabase = await createClient();

  // Carrega contas e categorias do household pra matching
  const [{ data: accounts }, { data: categories }, rates] = await Promise.all([
    supabase.from("accounts").select("id, name, currency, type").eq("is_active", true),
    supabase.from("categories").select("id, name, kind").eq("is_archived", false),
    getRateMap(),
  ]);

  const accountByName = new Map<string, { id: string; currency: Currency; type: string }>();
  for (const a of accounts ?? []) {
    accountByName.set(a.name.toLowerCase(), {
      id: a.id,
      currency: a.currency as Currency,
      type: a.type,
    });
  }
  const categoryByName = new Map<string, { id: string; kind: string }>();
  for (const c of categories ?? []) {
    categoryByName.set(c.name.toLowerCase(), { id: c.id, kind: c.kind });
  }

  // Validação prévia: coleta TODOS os erros antes de inserir nada.
  const errors: Array<{ index: number; error: string }> = [];
  const inserts: Array<{
    household_id: string;
    account_id: string;
    category_id: string | null;
    kind: TransactionKind;
    amount: number;
    amount_account: number;
    currency: Currency;
    description: string;
    payment_method: PaymentMethod | null;
    date: string;
    created_by: string;
    category_source: "manual";
    metadata: { imported: true };
  }> = [];

  rows.forEach((row, i) => {
    const lineNo = i + 2; // 1-indexed + cabeçalho

    if (row.kind === "transfer") {
      errors.push({ index: i, error: `Linha ${lineNo}: transferências não são suportadas no CSV. Use a página /recorrentes ou o botão "Lançar".` });
      return;
    }
    if (!row.description?.trim()) {
      errors.push({ index: i, error: `Linha ${lineNo}: descrição vazia.` });
      return;
    }
    if (!(row.amount > 0)) {
      errors.push({ index: i, error: `Linha ${lineNo}: valor inválido (${row.amount}).` });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push({ index: i, error: `Linha ${lineNo}: data inválida (${row.date}).` });
      return;
    }
    const acc = accountByName.get(row.accountName.toLowerCase());
    if (!acc) {
      errors.push({
        index: i,
        error: `Linha ${lineNo}: conta "${row.accountName}" não encontrada. Contas válidas: ${[...accountByName.keys()].join(", ")}`,
      });
      return;
    }
    let catId: string | null = null;
    if (row.categoryName?.trim()) {
      const cat = categoryByName.get(row.categoryName.toLowerCase());
      if (!cat) {
        errors.push({
          index: i,
          error: `Linha ${lineNo}: categoria "${row.categoryName}" não encontrada.`,
        });
        return;
      }
      catId = cat.id;
    }

    // amount_account: na moeda da conta. Se moeda da tx é diferente, converte.
    const amountAccount =
      row.currency === acc.currency
        ? row.amount
        : convertOrSame(row.amount, row.currency, acc.currency, rates);

    inserts.push({
      household_id: ctx.household.id,
      account_id: acc.id,
      category_id: catId,
      kind: row.kind,
      amount: row.amount,
      amount_account: amountAccount,
      currency: row.currency,
      description: row.description.trim(),
      payment_method: row.paymentMethod ?? null,
      date: row.date,
      created_by: ctx.profile.id,
      category_source: "manual",
      metadata: { imported: true },
    });
  });

  if (errors.length > 0) {
    return { errors, inserted: 0 };
  }

  // Insere em batches de 500 (limite seguro do Supabase)
  const BATCH = 500;
  let inserted = 0;
  for (let start = 0; start < inserts.length; start += BATCH) {
    const slice = inserts.slice(start, start + BATCH);
    const { data, error } = await supabase.from("transactions").insert(slice).select("id");
    if (error) {
      // Se falhar no meio, retorna o erro. Inconsistente mas raro
      // (RLS, constraint, etc.) — o user vê e re-tenta.
      return {
        errors: [{ index: -1, error: `Erro no batch ${start}-${start + slice.length}: ${error.message}` }],
        inserted,
      };
    }
    inserted += data?.length ?? 0;
  }

  revalidatePath("/transacoes");
  revalidatePath("/dashboard");
  revalidatePath("/analise");

  return { ok: true, inserted };
}
