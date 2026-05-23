import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchQuotes, isB3Ticker } from "@/lib/financial/brapi";
import type { Database } from "@/types/database";

/**
 * Cron de cotações: atualiza quote_snapshots pra TODOS os tickers da B3
 * (FIIs, ações, ETFs) ativos em qualquer household.
 *
 * Por que existir:
 *  - O cache de cotações é REATIVO — só refresca quando alguém abre o app.
 *  - Se ninguém abre /investimentos entre o fechamento de sexta (17:30 BRT)
 *    e segunda de manhã, o snapshot fica preso no último intraday — o usuário
 *    nunca vê o preço de fechamento.
 *  - Esse cron garante 2 fotografias por dia útil: 10:30 BRT (pós-abertura)
 *    e 18:30 BRT (pós-fechamento, com gap pra capturar ajustes after-hours).
 *
 * Schedule (vercel.json):
 *   { "path": "/api/cron/snapshot-quotes", "schedule": "30 13 * * 1-5" }  10:30 BRT
 *   { "path": "/api/cron/snapshot-quotes", "schedule": "30 21 * * 1-5" }  18:30 BRT
 *
 * Idempotente. fetchQuotes() já upserta — chamar duas vezes seguidas é seguro.
 */
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Pega todos os tickers únicos de ativos ativos
  const { data: invs, error } = await supabase
    .from("investments")
    .select("ticker")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tickers = Array.from(
    new Set((invs ?? []).map((i) => i.ticker.trim().toUpperCase())),
  ).filter(isB3Ticker);

  if (tickers.length === 0) {
    return NextResponse.json({ ok: true, tickers: 0, fetched: 0 });
  }

  // fetchQuotes ignora o TTL pq todos vão estar "stale" pra essa hora,
  // chama brapi e upserta. Resultado: snapshots fresquinhos.
  // Pra forçar refetch mesmo de snapshots "fresh", apagamos primeiro.
  const cutoffISO = new Date(Date.now() - 60_000).toISOString(); // últimos 60s não toca
  await supabase
    .from("quote_snapshots")
    .delete()
    .in("ticker", tickers)
    .lt("fetched_at", cutoffISO);

  // fetchQuotes vai ver snapshots ausentes → chamar brapi → upsertar
  const map = await fetchQuotes(tickers);

  const missing = tickers.filter((t) => !map.has(t));
  return NextResponse.json({
    ok: true,
    tickers: tickers.length,
    fetched: map.size,
    missing,
  });
}
