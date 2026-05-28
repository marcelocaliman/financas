import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NotaCorretagem } from "../document-types";

/**
 * Aplica nota de corretagem extraída: cria entradas em investment_movements
 * para cada operação. Faz match por ticker com investments existentes; se
 * não achar, cria um placeholder pendente de cadastro completo.
 *
 * NOTA: matching simples por ticker. Casos avançados (FII vs ação com
 * mesmo prefixo) ficam pra futuro.
 */
export async function applyNotaCorretagem(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: NotaCorretagem;
  /** Conta da corretora pra creditar/debitar caixa */
  accountId: string | null;
}): Promise<
  | { ok: true; createdIds: { investment_movements: string[]; investments_created: string[] } }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const supabase = await createClient();

  // Busca investments existentes pelos tickers da nota
  const tickers = Array.from(new Set(args.data.operations.map((o) => o.ticker.toUpperCase())));
  type InvBuilder = {
    select: (s: string) => {
      in: (
        c: string,
        v: string[],
      ) => { eq: (c: string, v: string) => Promise<{ data: Array<{ id: string; ticker: string }> | null }> };
    };
  };
  const { data: existingInvs } = await (
    supabase.from as unknown as (t: string) => InvBuilder
  )("investments")
    .select("id, ticker")
    .in("ticker", tickers)
    .eq("household_id", args.householdId);

  const tickerToId = new Map<string, string>();
  for (const inv of existingInvs ?? []) {
    tickerToId.set(inv.ticker.toUpperCase(), inv.id);
  }

  const investmentsCreated: string[] = [];

  // Cria investments placeholder pros tickers que não existem
  for (const ticker of tickers) {
    if (tickerToId.has(ticker)) continue;
    type CreateInv = {
      insert: (row: Record<string, unknown>) => {
        select: (s: string) => {
          single: () => Promise<{ data: { id: string } | null }>;
        };
      };
    };
    const { data: newInv } = await (
      admin.from as unknown as (t: string) => CreateInv
    )("investments")
      .insert({
        household_id: args.householdId,
        ticker,
        name: ticker,
        asset_type: "stock",
        initial_amount: 0,
        current_balance: 0,
        currency: "BRL",
        account_id: args.accountId,
        is_active: true,
        exclude_from_ir: false,
      })
      .select("id")
      .single();
    if (newInv?.id) {
      tickerToId.set(ticker, newInv.id);
      investmentsCreated.push(newInv.id);
    }
  }

  // Cria os movements
  const movementRows = args.data.operations
    .map((op) => {
      const invId = tickerToId.get(op.ticker.toUpperCase());
      if (!invId) return null;
      return {
        household_id: args.householdId,
        investment_id: invId,
        kind: op.side, // 'buy' | 'sell'
        date: args.data.trade_date,
        quantity: op.quantity,
        unit_price: op.unit_price,
        total_amount: op.net_total,
        ir_withheld: op.ir_withheld,
        metadata: {
          source: "openai_inbox",
          document_id: args.documentId,
          broker: args.data.broker_name,
          broker_cnpj: args.data.broker_cnpj,
          gross_total: op.gross_total,
          fees: op.fees,
        },
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  type MovBuilder = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
    };
  };
  const { data: insertedMovs, error: movError } = await (
    admin.from as unknown as (t: string) => MovBuilder
  )("investment_movements")
    .insert(movementRows)
    .select("id");

  if (movError) {
    return { ok: false, error: movError.message };
  }

  return {
    ok: true,
    createdIds: {
      investment_movements: insertedMovs?.map((r) => r.id) ?? [],
      investments_created: investmentsCreated,
    },
  };
}
