import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NotaCorretagem } from "../document-types";

/**
 * Aplica nota de corretagem extraída. Dedup por operação:
 * (investment_id, date, kind, qty, unit_price). Re-upload da mesma nota
 * não duplica.
 */
export async function applyNotaCorretagem(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: NotaCorretagem;
  accountId: string | null;
}): Promise<
  | {
      ok: true;
      createdIds: { investment_movements: string[]; investments_created: string[] };
      skippedCount: number;
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const supabase = await createClient();

  const tickers = Array.from(new Set(args.data.operations.map((o) => o.ticker.toUpperCase())));
  type InvBuilder = {
    select: (s: string) => {
      in: (
        c: string,
        v: string[],
      ) => {
        eq: (c: string, v: string) => Promise<{
          data: Array<{ id: string; ticker: string }> | null;
        }>;
      };
    };
  };
  const { data: existingInvs } = await (
    supabase.from as unknown as (t: string) => InvBuilder
  )("investments")
    .select("id, ticker")
    .in("ticker", tickers)
    .eq("household_id", args.householdId);

  const tickerToId = new Map<string, string>();
  for (const inv of existingInvs ?? []) tickerToId.set(inv.ticker.toUpperCase(), inv.id);

  const investmentsCreated: string[] = [];
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
        currency: args.data.currency ?? "BRL",
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

  // Busca movements existentes na data pra dedup
  const invIds = Array.from(tickerToId.values());
  type MovBuilder = {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        in: (
          c: string,
          v: string[],
        ) => Promise<{
          data: Array<{
            investment_id: string;
            kind: string;
            quantity: string | number;
            unit_price: string | number;
          }> | null;
        }>;
      };
    };
  };
  const { data: existingMovs } = await (
    supabase.from as unknown as (t: string) => MovBuilder
  )("investment_movements")
    .select("investment_id, kind, quantity, unit_price")
    .eq("date", args.data.trade_date)
    .in("investment_id", invIds.length > 0 ? invIds : ["00000000-0000-0000-0000-000000000000"]);

  const existingKeys = new Set<string>();
  for (const m of existingMovs ?? []) {
    const key = `${m.investment_id}|${m.kind}|${Math.round(Number(m.quantity) * 1e6)}|${Math.round(Number(m.unit_price) * 100)}`;
    existingKeys.add(key);
  }

  // Filtra operações
  const movementRows = [];
  let skippedCount = 0;
  for (const op of args.data.operations) {
    const invId = tickerToId.get(op.ticker.toUpperCase());
    if (!invId) continue;
    const key = `${invId}|${op.side}|${Math.round(op.quantity * 1e6)}|${Math.round(op.unit_price * 100)}`;
    if (existingKeys.has(key)) {
      skippedCount++;
      continue;
    }
    movementRows.push({
      household_id: args.householdId,
      investment_id: invId,
      kind: op.side,
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
        currency: args.data.currency ?? "BRL",
      },
    });
  }

  if (movementRows.length === 0) {
    return {
      ok: true,
      createdIds: { investment_movements: [], investments_created: investmentsCreated },
      skippedCount,
    };
  }

  type Insert = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  const { data: inserted, error } = await (
    admin.from as unknown as (t: string) => Insert
  )("investment_movements")
    .insert(movementRows)
    .select("id");

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    createdIds: {
      investment_movements: inserted?.map((r) => r.id) ?? [],
      investments_created: investmentsCreated,
    },
    skippedCount,
  };
}
