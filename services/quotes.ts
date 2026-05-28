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

/**
 * Snapshot dos dados de um ativo pro consumo das tables/popovers de UI.
 *
 * Substitui `LiveAssetMetrics` (do lib/financial/live-yield.ts) — campos
 * dinâmicos como dailyYield/perSecond/accumulatedYield ficam 0 já que o
 * compound diário foi removido (usuário atualiza current_balance manualmente).
 *
 * Mantemos a forma do objeto pra não quebrar a interface dos componentes.
 */
export type AssetSnapshot = {
  id: string;
  ticker: string;
  /** Saldo "base" = current_balance do banco (pra RF e similares) */
  baseBalance: number;
  /** Valor de mercado = quote × quantity (só pra B3 com cotação brapi) */
  marketBalance: number;
  /** Sempre 0 — compound foi removido */
  dailyYield: number;
  /** Sempre 0 — compound foi removido */
  perSecond: number;
  /** Sempre 0 — compound foi removido */
  accumulatedYield: number;
  /** Sempre 0 — compound foi removido */
  accumulatedDividends: number;
  /** Sempre = baseBalance (sem compound, não há diferença) */
  checkpointBalance: number;
  /** Sempre false — sem compound, não há estimativa */
  isEstimate: boolean;
  /** Quantidade do ativo (pra UIs que mostram cotas × preço) */
  quantity: number | null;
  /** Preço unitário atual (cota brapi se disponível, undefined caso contrário) */
  marketPrice: number | null;
  /** Preço médio = initial_amount / quantity (se quantity > 0) */
  averagePrice: number | null;
  /** Ganho atual = marketBalance - initialAmount (pra ações) */
  marketGain: number;
  marketGainPct: number;
  /** Alias de marketGainPct (compat) */
  marketChangePct: number;
  /** Origem do valor */
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
  /** Total agregado em displayCurrency */
  totalMarketBalance: number;
  /** Soma de investido (initial_amount convertido) */
  totalBaseBalance: number;
  /** Agregação por classe pro dashboard e UIs */
  byClass: {
    fixedIncome: { balance: number };
    fiis: { balance: number };
    stocks: { balance: number };
    other: { balance: number };
  };
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
    .select("id, ticker, asset_type, current_balance, initial_amount, quantity, currency")
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
  const byClass = {
    fixedIncome: { balance: 0 },
    fiis: { balance: 0 },
    stocks: { balance: 0 },
    other: { balance: 0 },
  };
  let totalMarketBalance = 0;
  let totalBaseBalance = 0;

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
    totalMarketBalance += value;

    const initial = Number(inv.initial_amount ?? 0);
    const initialDisplay =
      native === displayCurrency
        ? initial
        : convertOrSame(initial, native, displayCurrency, rates);
    totalBaseBalance += initialDisplay;

    switch (inv.asset_type) {
      case "fixed_income_public":
      case "fixed_income_private":
        byClass.fixedIncome.balance += value;
        break;
      case "fii":
        byClass.fiis.balance += value;
        break;
      case "stock":
      case "etf":
        byClass.stocks.balance += value;
        break;
      default:
        byClass.other.balance += value;
    }
  }

  return {
    map,
    byAsset,
    quotes,
    displayCurrency,
    totalMarketBalance: Math.round(totalMarketBalance * 100) / 100,
    totalBaseBalance: Math.round(totalBaseBalance * 100) / 100,
    byClass,
  };
});

/**
 * Snapshots ricos de cada ativo, pra UIs (tables, popovers) que precisam
 * de mais que só o valor — preço unitário, quantidade, ganho, etc.
 *
 * Cacheado por request.
 */
export const getAssetSnapshotMap = cache(async (): Promise<Map<string, AssetSnapshot>> => {
  const supabase = await createClient();
  const [displayCurrency, rates, { quotes }] = await Promise.all([
    getDisplayCurrency(),
    getRateMap(),
    getCurrentValueMap(),
  ]);

  const { data: investments } = await supabase
    .from("investments")
    .select("id, ticker, asset_type, current_balance, initial_amount, quantity, currency")
    .eq("is_active", true);

  const out = new Map<string, AssetSnapshot>();
  for (const inv of investments ?? []) {
    const native = (inv.currency ?? "BRL") as Currency;
    const quote = quotes.get(inv.ticker);
    const qty = inv.quantity != null ? Number(inv.quantity) : null;
    const initial = Number(inv.initial_amount ?? 0);
    const currentBalance = Number(inv.current_balance ?? 0);

    const baseBalance =
      native === displayCurrency
        ? currentBalance
        : convertOrSame(currentBalance, native, displayCurrency, rates);
    const marketBalance =
      quote && qty != null && qty > 0 ? quote.regularMarketPrice * qty : baseBalance;
    const initialDisplay =
      native === displayCurrency ? initial : convertOrSame(initial, native, displayCurrency, rates);
    const marketGain = marketBalance - initialDisplay;
    const marketGainPct = initialDisplay > 0 ? marketGain / initialDisplay : 0;
    const averagePrice = qty != null && qty > 0 ? initialDisplay / qty : null;

    const baseRounded = Math.round(baseBalance * 100) / 100;
    out.set(inv.id, {
      id: inv.id,
      ticker: inv.ticker,
      baseBalance: baseRounded,
      marketBalance: Math.round(marketBalance * 100) / 100,
      dailyYield: 0,
      perSecond: 0,
      accumulatedYield: 0,
      accumulatedDividends: 0,
      checkpointBalance: baseRounded,
      isEstimate: false,
      quantity: qty,
      marketPrice: quote?.regularMarketPrice ?? null,
      averagePrice,
      marketGain: Math.round(marketGain * 100) / 100,
      marketGainPct,
      marketChangePct: marketGainPct,
      source: quote && qty != null && qty > 0 ? "quote" : "manual",
    });
  }

  return out;
});
