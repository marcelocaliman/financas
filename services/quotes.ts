import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchQuotes, isB3Ticker, type Quote } from "@/lib/financial/brapi";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { Currency } from "@/types/database";

/**
 * Cotações + valores atuais por ativo (sem compound de Selic/CDI).
 *
 * Substitui `services/live-yield.ts` que fazia compound diário automático
 * em renda fixa. Agora cada `current_balance` no banco É a fonte de verdade,
 * atualizado manualmente pelo usuário quando ele quer.
 *
 * Pra ações/FIIs/ETFs continuamos consultando brapi (cotação em tempo real),
 * porque cotação muda o tempo todo e bater no broker pra atualizar manualmente
 * seria insano. Mas o "investido" e a "quantidade" são manuais; só a cotação
 * é puxada.
 */

export type AssetCurrentValue = {
  /** Investment ID */
  id: string;
  /** Valor atual em displayCurrency (cotação × qty pra B3, current_balance pra resto) */
  value: number;
  /** Indica se o valor veio de cotação live (brapi) ou do current_balance manual */
  source: "quote" | "manual";
};

export type CurrentValueResult = {
  /** Map investment.id → valor atual em displayCurrency */
  map: Map<string, number>;
  /** Detalhe por ativo (pra UIs que precisam saber a origem) */
  byAsset: AssetCurrentValue[];
  /** Cotações cruas da brapi (pra UIs que mostram preço unitário) */
  quotes: Map<string, Quote>;
  displayCurrency: Currency;
};

/**
 * Computa o "valor atual" de cada investimento ativo.
 *  - B3 (ações/FIIs/ETFs): cotação brapi × quantidade
 *  - Resto (RF, cripto, outros): current_balance do banco
 *
 * Cacheado por request.
 */
export const getCurrentValueMap = cache(async (): Promise<CurrentValueResult> => {
  const supabase = await createClient();
  const [displayCurrency, rates] = await Promise.all([getDisplayCurrency(), getRateMap()]);

  const { data: investments } = await supabase
    .from("investments")
    .select("id, ticker, asset_type, current_balance, quantity, currency")
    .eq("is_active", true);

  const list = investments ?? [];

  // Cotações brapi pros tickers B3
  const b3Tickers = list.filter((i) => isB3Ticker(i.ticker)).map((i) => i.ticker);
  const rawQuotes: Map<string, Quote> =
    b3Tickers.length > 0 ? await fetchQuotes(b3Tickers) : new Map();

  // brapi devolve em BRL — converte pra displayCurrency
  const brlToDisplay = convertOrSame(1, "BRL", displayCurrency, rates);
  const quotes = new Map<string, Quote>();
  for (const [ticker, q] of rawQuotes) {
    quotes.set(ticker, { ...q, regularMarketPrice: q.regularMarketPrice * brlToDisplay });
  }

  const map = new Map<string, number>();
  const byAsset: AssetCurrentValue[] = [];

  for (const inv of list) {
    const native = (inv.currency ?? "BRL") as Currency;
    const quote = quotes.get(inv.ticker);

    let value: number;
    let source: "quote" | "manual";

    if (quote && inv.quantity != null && Number(inv.quantity) > 0) {
      // Ativo B3 com cotação: market value
      value = quote.regularMarketPrice * Number(inv.quantity);
      source = "quote";
    } else {
      // RF, cripto, ou ativo sem cotação: usa current_balance
      const raw = Number(inv.current_balance ?? 0);
      value = native === displayCurrency ? raw : convertOrSame(raw, native, displayCurrency, rates);
      source = "manual";
    }

    map.set(inv.id, value);
    byAsset.push({ id: inv.id, value, source });
  }

  return { map, byAsset, quotes, displayCurrency };
});
