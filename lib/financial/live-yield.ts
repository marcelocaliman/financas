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
import {
  businessDaysSinceContinuous,
  isBusinessDay,
  todayBusinessProgress,
} from "./business-days";

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
  /** Soma lifetime de proventos recebidos (movements kind='dividend'). */
  lifetime_dividends_received: number;
  purchase_date: string;
  last_yield_at: string | null;
};

export type LiveAssetMetrics = {
  id: string;
  ticker: string;
  /** saldo derivado (composto desde o checkpoint) — é o que a UI mostra */
  baseBalance: number;
  /** saldo persistido bruto (current_balance do banco) — só pra debug */
  checkpointBalance: number;
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
  /**
   * Rendimento acumulado LIFETIME em R$.
   *   renda fixa  → derivedBalance − initial_amount (composição contínua)
   *   renda var.  → (derivedBalance|marketBalance − initial_amount)
   *                 + lifetime_dividends_received (apreciação + proventos)
   * Saques invadindo principal podem deixar negativo em RF, mas a regra
   * cascading do withdrawYield evita esse caso.
   * null pra ativos sem trilho de rendimento e sem cotação.
   */
  accumulatedYield: number | null;
  /** Soma lifetime de proventos recebidos (renda variável). 0 pra renda fixa. */
  accumulatedDividends: number;
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
  /**
   * Rendimento acumulado da renda fixa (derivedBalance - initial_amount),
   * com composição contínua em dias úteis (excluindo fim de semana e
   * feriados nacionais BR). Já inclui fração do dia útil atual em SP.
   */
  totalFixedIncomeAccumulatedYield: number;
  /**
   * True se hoje (em São Paulo) é dia útil. Usado pelo client pra decidir
   * se anima o contador (somente em dias úteis) ou pausa (fds/feriados).
   */
  isBusinessDayToday: boolean;
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

/**
 * Saldo coerente "agora" para renda fixa indexada/prefixada:
 *   checkpoint × (1 + daily)^dias_úteis_fracionais_desde_checkpoint
 *
 * Usa contagem REAL de dias úteis (excluindo finais de semana e feriados
 * nacionais brasileiros), com fração do dia atual quando hoje é dia útil.
 * Resultado: composição contínua matematicamente correta.
 *
 * `current_balance` é só a foto da última vez que o cron rodou (ou da compra).
 */
function deriveCheckpointBalance(
  currentBalance: number,
  lastYieldAt: string | null,
  purchaseDate: string,
  dailyRate: number,
  now: Date,
): number {
  if (dailyRate <= 0) return currentBalance;
  const ref = lastYieldAt ?? purchaseDate;
  const days = businessDaysSinceContinuous(ref, now);
  if (days <= 0) return currentBalance;
  return currentBalance * Math.pow(1 + dailyRate, days);
}

export function computeLivePortfolio(args: {
  investments: LiveInvestmentInput[];
  indexers: Record<IndexerCode, number | null>;
  yields12mByInvestmentId: Map<string, { totalNet: number; months: number }>;
  quotes: Map<string, Quote>;
  shareCountByInvestmentId?: Map<string, number>;
  /** Momento de referência para derivação do saldo (default: agora). */
  now?: Date;
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
  let totalFixedIncomeAccumulatedYield = 0;

  const now = args.now ?? new Date();

  for (const inv of args.investments) {
    const checkpointBalance = Number(inv.current_balance ?? 0);
    let derivedBalance = checkpointBalance;

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
      const effectiveAnnual = indexers[inv.indexer]! * multiplier;
      const dailyRate = dailyFromAnnualPct(effectiveAnnual);
      derivedBalance = deriveCheckpointBalance(
        checkpointBalance,
        inv.last_yield_at,
        inv.purchase_date,
        dailyRate,
        now,
      );
      dailyYield = derivedBalance * dailyRate;
      source = `${Math.round(multiplier * 100)}% ${inv.indexer.toUpperCase()} (${effectiveAnnual.toFixed(2)}% a.a.)`;
    }
    // ============================================================
    // Prefixado
    // ============================================================
    else if (inv.indexer === "fixed" && inv.fixed_rate != null) {
      const dailyRate = dailyFromAnnualPct(Number(inv.fixed_rate));
      derivedBalance = deriveCheckpointBalance(
        checkpointBalance,
        inv.last_yield_at,
        inv.purchase_date,
        dailyRate,
        now,
      );
      dailyYield = derivedBalance * dailyRate;
      source = `Prefixado ${inv.fixed_rate}% a.a.`;
    }
    // ============================================================
    // IPCA+ (aproximação: IPCA mensal anualizado × (1 + spread))
    // ============================================================
    else if (inv.indexer === "ipca" && ipcaAnnual != null) {
      const spread = Number(inv.fixed_rate ?? 0);
      const effectiveAnnual =
        ((1 + ipcaAnnual / 100) * (1 + spread / 100) - 1) * 100;
      const dailyRate = dailyFromAnnualPct(effectiveAnnual);
      derivedBalance = deriveCheckpointBalance(
        checkpointBalance,
        inv.last_yield_at,
        inv.purchase_date,
        dailyRate,
        now,
      );
      dailyYield = derivedBalance * dailyRate;
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
    totalBaseBalance += derivedBalance;
    totalMarketBalance += marketBalance ?? derivedBalance;

    // Bucket por classe — saldo da renda fixa usa derivedBalance
    if (
      inv.asset_type === "fixed_income_public" ||
      inv.asset_type === "fixed_income_private"
    ) {
      byClass.fixedIncome.balance += derivedBalance;
      byClass.fixedIncome.dailyYield += dailyYield;
      byClass.fixedIncome.perSecond += perSecond;
      // Rendimento acumulado deste ativo: saldo derivado − custo aplicado.
      // Aportes elevam ambos igualmente (delta neutro). Saques de yield
      // diminuem derivedBalance (initial_amount fica) → subtraem corretamente.
      const accumulated = derivedBalance - Number(inv.initial_amount ?? 0);
      totalFixedIncomeAccumulatedYield += accumulated;
    } else if (inv.asset_type === "fii") {
      byClass.fiis.balance += marketBalance ?? derivedBalance;
      byClass.fiis.dailyYield += dailyYield;
      byClass.fiis.perSecond += perSecond;
    } else if (inv.asset_type === "stock" || inv.asset_type === "etf") {
      byClass.stocks.balance += marketBalance ?? derivedBalance;
      byClass.stocks.dailyYield += dailyYield;
      byClass.stocks.perSecond += perSecond;
    } else {
      byClass.other.balance += derivedBalance;
    }

    const marketGain =
      marketBalance != null ? marketBalance - Number(inv.initial_amount) : null;
    const marketGainPct =
      marketGain != null && Number(inv.initial_amount) > 0
        ? marketGain / Number(inv.initial_amount)
        : null;

    // Lifetime accumulated yield (em R$, na moeda de exibição):
    //   renda fixa  → derivedBalance − initial_amount (composição contínua)
    //   renda var.  → (marketBalance|derivedBalance − initial_amount) + dividends
    //                 — apreciação + caixa de proventos já recebido
    const accumulatedDividends = Number(inv.lifetime_dividends_received ?? 0);
    const isFixedIncome =
      inv.asset_type === "fixed_income_public" ||
      inv.asset_type === "fixed_income_private";
    const variableBase = marketBalance ?? derivedBalance;
    let accumulatedYield: number | null = null;
    if (isFixedIncome) {
      accumulatedYield = derivedBalance - Number(inv.initial_amount ?? 0);
    } else if (
      inv.asset_type === "fii" ||
      inv.asset_type === "stock" ||
      inv.asset_type === "etf"
    ) {
      accumulatedYield =
        variableBase - Number(inv.initial_amount ?? 0) + accumulatedDividends;
    }

    byAsset.push({
      id: inv.id,
      ticker: inv.ticker,
      baseBalance: derivedBalance,
      checkpointBalance,
      marketBalance,
      averagePrice,
      quantity,
      marketPrice,
      marketGain,
      marketGainPct,
      dailyYield: Math.round(dailyYield * 1e6) / 1e6,
      perSecond: perSecond,
      accumulatedYield:
        accumulatedYield != null ? Math.round(accumulatedYield * 100) / 100 : null,
      accumulatedDividends: Math.round(accumulatedDividends * 100) / 100,
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
    totalFixedIncomeAccumulatedYield:
      Math.round(totalFixedIncomeAccumulatedYield * 100) / 100,
    isBusinessDayToday: isBusinessDay(now),
    byAsset,
    byClass,
  };
}

/**
 * Fração do dia útil corrente já transcorrida (em America/Sao_Paulo).
 *
 * IMPORTANTE: delega pra `todayBusinessProgress` (fração de 24h em SP, 0
 * em fim de semana/feriado) pra ficar EM SINCRONIA com o cálculo do
 * `derivedBalance` server-side, que também usa `todayBusinessProgress`
 * dentro de `businessDaysSinceContinuous`.
 *
 * Antes, esta função usava janela de pregão (10h-18h) e retornava 1 em fim
 * de semana — o que duplicava o yield no client (servidor já incluía sexta
 * no base, e o ticker somava mais um `dailyYield × 1` em cima).
 *
 * Agora cliente e servidor concordam:
 *  - Dia útil em SP: ratio = fração do dia (00h→24h)
 *  - Fim de semana ou feriado: ratio = 0 (sem yield novo; tudo já no base)
 */
export function dayUtilizationRatio(now: Date = new Date()): number {
  return todayBusinessProgress(now);
}
