import { NextResponse, type NextRequest } from "next/server";
import { fetchQuotes, isB3Ticker } from "@/lib/financial/brapi";

/**
 * Endpoint que o client chama a cada ~60s pra refrescar cotações.
 * Recebe ?tickers=PETR4,MXRF11,... e devolve {symbol, price, changePct}[].
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam.split(",").map((t) => t.trim()).filter(isB3Ticker);

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  const map = await fetchQuotes(tickers);
  const quotes = Array.from(map.values()).map((q) => ({
    symbol: q.symbol,
    price: q.regularMarketPrice,
    changePct: q.regularMarketChangePercent,
    time: q.regularMarketTime ?? null,
  }));

  return NextResponse.json({ quotes });
}
