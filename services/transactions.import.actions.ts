"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { getRateMap } from "@/services/currency";
import { convertOrSame } from "@/lib/financial/currency";
import { findDuplicate, type ExistingTx, type DedupeCandidate } from "@/services/import-dedupe";
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
  /** Linhas puladas por já existir transação equivalente (dedupe). */
  skippedDuplicates?: Array<{
    index: number;
    candidateDescription: string;
    existingDescription: string;
    existingDate: string;
    reason: string;
  }>;
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

  // ───── Dedupe: detecta transações já existentes que provavelmente são
  // as mesmas das do CSV. Ex: recorrência materializou Claude AI dia 15,
  // depois o CSV da fatura vem com a mesma cobrança. Sem dedupe, duplica.
  //
  // Estratégia: pre-fetch tx existentes no range de datas dos inserts
  // (com janela ±3 dias) e match em memória via heurística (descrição
  // similar + valor próximo).
  const insertDates = inserts.map((i) => i.date).sort();
  const minDate = insertDates[0];
  const maxDate = insertDates[insertDates.length - 1];
  const expandDay = (d: string, n: number) => {
    const dt = new Date(d + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const accountIdsTouched = Array.from(new Set(inserts.map((i) => i.account_id)));
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, account_id, kind, date, amount_account, description, recurring_rule_id")
    .eq("household_id", ctx.household.id)
    .in("account_id", accountIdsTouched)
    .gte("date", expandDay(minDate, -3))
    .lte("date", expandDay(maxDate, 3));

  const existingTxs = (existing ?? []) as ExistingTx[];
  const skippedDuplicates: NonNullable<ImportResult["skippedDuplicates"]> = [];
  const toInsert: typeof inserts = [];
  // Consome cada existing após casar, pra duas linhas iguais do CSV não casarem
  // ambas com a mesma tx existente (descartaria uma transação real).
  const consumedIds = new Set<string>();

  inserts.forEach((row, i) => {
    const candidate: DedupeCandidate = {
      account_id: row.account_id,
      kind: row.kind,
      date: row.date,
      amount_account: row.amount_account,
      description: row.description,
    };
    const match = findDuplicate(candidate, existingTxs, consumedIds);
    if (match) {
      consumedIds.add(match.id);
      skippedDuplicates.push({
        index: i,
        candidateDescription: row.description,
        existingDescription: match.description,
        existingDate: match.date,
        reason: match.recurring_rule_id
          ? "já materializada via recorrência"
          : "transação equivalente já existe",
      });
      return;
    }
    toInsert.push(row);
  });

  // Insere o que sobrou em batches de 500
  const BATCH = 500;
  let inserted = 0;
  for (let start = 0; start < toInsert.length; start += BATCH) {
    const slice = toInsert.slice(start, start + BATCH);
    const { data, error } = await supabase.from("transactions").insert(slice).select("id");
    if (error) {
      return {
        errors: [{ index: -1, error: `Erro no batch ${start}-${start + slice.length}: ${error.message}` }],
        inserted,
        skippedDuplicates,
      };
    }
    inserted += data?.length ?? 0;
  }

  // Auto-categoriza o que entrou sem categoria via regras do household — antes
  // o import em massa não aplicava regras (só o lançamento manual), obrigando o
  // usuário a recategorizar à mão. Best-effort: não falha o import se der erro.
  if (inserted > 0) {
    try {
      const { applyRulesToUncategorized } = await import("@/services/category-rules.actions");
      await applyRulesToUncategorized();
    } catch {
      /* não bloqueia o import */
    }
    // Re-deriva os saldos das contas a partir dos lançamentos — import em lote
    // podia deixar o current_balance fora de sincronia (drift). Auto-cura.
    try {
      await supabase.rpc("recompute_household_balances");
    } catch {
      /* não bloqueia o import */
    }
  }

  revalidatePath("/transacoes");
  revalidatePath("/dashboard");
  revalidatePath("/analise");

  return {
    ok: true,
    inserted,
    skippedDuplicates: skippedDuplicates.length > 0 ? skippedDuplicates : undefined,
  };
}
