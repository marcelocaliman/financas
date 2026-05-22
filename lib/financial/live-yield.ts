/**
 * Cálculo de rendimento "ao vivo" para o portfólio.
 *
 * Pura: recebe ativos + indexadores + histórico de dividendos + cotações
 * e devolve taxas estruturadas. Quem anima a UI a cada segundo é o client.
 *
 * Premissas:
 *  - Dia útil = 8h "perceptíveis" de rendimento = 28800s. Cosmético.
 *  - Renda fixa indexada (Selic/CDI): real, bate com extrato.
 *  - Renda fixa prefixada/IPCA+: bate em base anual, IPCA é aproximação mensal anualizada.
 *  - FII/Ação dividendos: ESTIMATIVA pela média dos últimos 12 meses de yields.
 *  - Cotação de mercado: do brapi.dev, marca a valor de mercado quando disponível.
 */

import type { Quote } from "./brapi";

type IndexerCode = "selic" | "cdi" | "ipca";

export type LiveInvestmentInput = {
  id: string;
  ticker: string;
  name: string;
  asset_type: "fii" | "fixed_income_public" | "fixed_income_private" | "stock" | "etf" | "crypto";
  indexer: "selic" | "cdi" | "ipca" | "fixed" | "none" | null;
  indexer_multiplier: number | null;
  fixed_rate: number | null;
  current_balance: number;
  initial_amount: number;
  /** Quantidade derivada dos lotes (investment_movements). null pra renda fixa. */
  quantity: number | null;
};

export type LiveAssetMetrics = {
  id: string;
  ticker: string;
  /** saldo persistido (atualizado pelo cron diário) */
  baseBalance: number;
  /** saldo a valor de mercado (brapi) — só pra FIIs/ações/ETFs */
  marketBalance: number | null;
  /** preço médio = initial_amount / quantity */
  averagePrice: number | null;
  /** quantidade total */
  quantity: number | null;
  /** preço de mercado atual (brapi) */
  marketPrice: number | null;
  /** ganho/perda absoluto a valor de mercado vs custo aplicado */
  marketGain: number | null;
  /** ganho/perda em % vs custo aplicado */
  marketGainPct: number | null;
  /** rendimento esperado por dia útil em R$ (acumulação composta) */
  dailyYield: number;
  /** R$ por segundo (dailyYield / 28800) */
  perSecond: number;
  /** descrição do método ("Selic 14,5%", "Dividendos médios 12m", etc.) */
  source: string;
  /** se a fonte é estimativa vs cálculo direto */
  isEstimate: boolean;
  /** variação % a valor de mercado no dia (brapi) */
  marketChangePct?: number;
};

export type LivePortfolio = {
  totalBaseBalance: number;
  totalMarketBalance: number;
  totalDailyYield: number;
  totalPerSecond: number;
  byAsset: LiveAssetMetrics[];
  byClass: {
    fixedIncome: { dailyYield: number; perSecond: number; balance: number };
    fiis: { dailyYield: number; perSecond: number; balance: number };
    stocks: { dailyYield: number; perSecond: number; balance: number };
    other: { dailyYield: number; perSecond: number; balance: number };
  };
};

const SECONDS_PER_UTIL_DAY = 28800; // 8h * 3600

/**
 * Rendimento diário composto (base 252 dias úteis) a partir de uma taxa anual.
 */
function dailyFromAnnualPct(annualPct: number): number {
  if (annualPct <= 0) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 252) - 1;
}

/**
 * Anualiza um IPCA mensal (% ao mês) para % ao ano.
 */
function ipcaMonthlyToAnnual(monthlyPct: number): number {
  return (Math.pow(1 + monthlyPct / 100, 12) - 1) * 100;
}

export function computeLivePortfolio(args: {
  investments: LiveInvestmentInput[];
  indexers: Record<IndexerCode, number | null>; // último valor disponível em %
  /** Soma dos rendimentos líquidos dos últimos 12 meses por investment_id */
  yields12mByInvestmentId: Map<string, { totalNet: number; months: number }>;
  /** Cotações ao vivo da B3 por ticker (uppercase) */
  quotes: Map<string, Quote>;
  /** Quantidade (cotas) por investment_id, opcional. Se não houver, derivamos do current_balance dividindo pelo último preço; pra v1, usa simplesmente o ratio aplicado/atual. */
  shareCountByInvestmentId?: Map<string, number>;
}): LivePortfolio {
  const indexers = args.indexers;
  const ipcaAnnual = indexers.ipca != null ? ipcaMonthlyToAnnual(indexers.ipca) : null;

  const byAsset: LiveAssetMetrics[] = [];
  const byClass = {
    fixedIncome: { dailyYield: 0, perSecond: 0, balance: 0 },
    fiis: { dailyYield: 0, perSecond: 0, balance: 0 },
    stocks: { dailyYield: 0, perSecond: 0, balance: 0 },
    other: { dailyYield: 0, perSecond: 0, balance: 0 },
  };

  let totalBaseBalance = 0;
  let totalMarketBalance = 0;
  let totalDailyYield = 0;

  for (const inv of args.investments) {
    const baseBalance = Number(inv.current_balance ?? 0);
    totalBaseBalance += baseBalance;

    let dailyYield = 0;
    let source = "—";
    let isEstimate = false;
    let marketBalance: number | null = null;
    let marketChangePct: number | undefined;
    let marketPrice: number | null = null;
    const quantity = inv.quantity != null ? Number(inv.quantity) : null;
    const averagePrice =
      quantity && quantity > 0 ? Number(inv.initial_amount) / quantity : null;

    // ============================================================
    // Renda fixa indexada (Selic/CDI)
    // ============================================================
    if (
      (inv.indexer === "selic" || inv.indexer === "cdi") &&
      indexers[inv.indexer] != null
    ) {
      const multiplier = Number(inv.indexer_multiplier ?? 1);
      const effectiveAnnual = (indexers[inv.indexer]! * multiplier);
      const dailyRate = dailyFromAnnualPct(effectiveAnnual);
      dailyYield = baseBalance * dailyRate;
      source = `${Math.round(multiplier * 100)}% ${inv.indexer.toUpperCase()} (${effectiveAnnual.toFixed(2)}% a.a.)`;
    }
    // ============================================================
    // Prefixado
    // ============================================================
    else if (inv.indexer === "fixed" && inv.fixed_rate != null) {
      const dailyRate = dailyFromAnnualPct(Number(inv.fixed_rate));
      dailyYield = baseBalance * dailyRate;
      source = `Prefixado ${inv.fixed_rate}% a.a.`;
    }
    // ============================================================
    // IPCA+ (aproximação: IPCA mensal anualizado × (1 + spread))
    // ============================================================
    else if (inv.indexer === "ipca" && ipcaAnnual != null) {
      const spread = Number(inv.fixed_rate ?? 0);
      // Efetiva ≈ (1 + ipca_anual/100) × (1 + spread/100) − 1
      const effectiveAnnual =
        ((1 + ipcaAnnual / 100) * (1 + spread / 100) - 1) * 100;
      const dailyRate = dailyFromAnnualPct(effectiveAnnual);
      dailyYield = baseBalance * dailyRate;
      source = `IPCA + ${spread.toFixed(2)}% (≈${effectiveAnnual.toFixed(2)}% a.a.)`;
    }
    // ============================================================
    // FII, ETF, ação — estimativa de proventos pela média de 12m
    // ============================================================
    else if (
      inv.asset_type === "fii" ||
      inv.asset_type === "stock" ||
      inv.asset_type === "etf"
    ) {
      const y = args.yields12mByInvestmentId.get(inv.id);
      if (y && y.months > 0) {
        const monthlyAvg = y.totalNet / y.months;
        // distribui no número de dias úteis ~21
        dailyYield = monthlyAvg / 21;
        source = `Média de proventos ${y.months}m (R$ ${monthlyAvg.toFixed(2)}/mês)`;
        isEstimate = true;
      }

      // Marcação a mercado via brapi — usa quantity real do investments
      const quote = args.quotes.get(inv.ticker.toUpperCase());
      if (quote) {
        marketPrice = quote.regularMarketPrice;
        if (quantity && quantity > 0) {
          marketBalance = quantity * quote.regularMarketPrice;
        }
        marketChangePct = quote.regularMarketChangePercent ?? 0;
      }
    }

    const perSecond = dailyYield / SECONDS_PER_UTIL_DAY;
    totalDailyYield += dailyYield;
    totalMarketBalance += marketBalance ?? baseBalance;

    // Bucket por classe
    if (
      inv.asset_type === "fixed_income_public" ||
      inv.asset_type === "fixed_income_private"
    ) {
      byClass.fixedIncome.balance += baseBalance;
      byClass.fixedIncome.dailyYield += dailyYield;
      byClass.fixedIncome.perSecond += perSecond;
    } else if (inv.asset_type === "fii") {
      byClass.fiis.balance += marketBalance ?? baseBalance;
      byClass.fiis.dailyYield += dailyYield;
      byClass.fiis.perSecond += perSecond;
    } else if (inv.asset_type === "stock" || inv.asset_type === "etf") {
      byClass.stocks.balance += marketBalance ?? baseBalance;
      byClass.stocks.dailyYield += dailyYield;
      byClass.stocks.perSecond += perSecond;
    } else {
      byClass.other.balance += baseBalance;
    }

    const marketGain =
      marketBalance != null ? marketBalance - Number(inv.initial_amount) : null;
    const marketGainPct =
      marketGain != null && Number(inv.initial_amount) > 0
        ? marketGain / Number(inv.initial_amount)
        : null;

    byAsset.push({
      id: inv.id,
      ticker: inv.ticker,
      baseBalance,
      marketBalance,
      averagePrice,
      quantity,
      marketPrice,
      marketGain,
      marketGainPct,
      dailyYield: Math.round(dailyYield * 1e6) / 1e6,
      perSecond: perSecond,
      source,
      isEstimate,
      marketChangePct,
    });
  }

  return {
    totalBaseBalance: Math.round(totalBaseBalance * 100) / 100,
    totalMarketBalance: Math.round(totalMarketBalance * 100) / 100,
    totalDailyYield: Math.round(totalDailyYield * 100) / 100,
    totalPerSecond: totalDailyYield / SECONDS_PER_UTIL_DAY,
    byAsset,
    byClass,
  };
}

/**
 * Fração do dia útil já transcorrida agora (em America/Sao_Paulo).
 * Útil pra mostrar "Hoje (até agora)" sem precisar de banco.
 * Considera 10h-18h BRT como janela útil.
 */
export function dayUtilizationRatio(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const second = Number(parts.find((p) => p.type === "second")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return 1; // weekend: já contou tudo de sexta

  const secondsToday = hour * 3600 + minute * 60 + second;
  const start = 10 * 3600;
  const end = 18 * 3600;
  if (secondsToday < start) return 0;
  if (secondsToday > end) return 1;
  return (secondsToday - start) / (end - start);
}
