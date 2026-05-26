/**
 * Projeção profissional de patrimônio investido com Monte Carlo.
 *
 * Características (Nível C, sem reinvestimento automático de dividendos):
 *   - Por ativo: usa indexer/multiplier/fixed_rate específicos
 *   - Líquido de IR (RF: 15% sobre rendimento; ações: deferred)
 *   - Maturidade: títulos que vencem viram cash (0% retorno depois)
 *   - Aportes mensais configuráveis (distribuídos por peso atual)
 *   - Stocks/FIIs projetam SÓ capital appreciation (sem reinvestir dividendos)
 *   - Monte Carlo 500 trials → bands p10/p50/p90
 *
 * Lib pura (sem dependência de DB/Next) — usável server-side e client-side.
 */

export type AssetType =
  | "stock"
  | "fii"
  | "etf"
  | "fixed_income_public"
  | "fixed_income_private"
  | "crypto"
  | "option"
  | "pgbl"
  | "vgbl"
  | "other";

/** Snapshot mínimo de um ativo pra projeção. */
export type AssetSnapshot = {
  id: string;
  name: string;
  asset_type: AssetType;
  current_balance: number;
  indexer: string | null;
  indexer_multiplier: number | null;
  fixed_rate: number | null;
  /** Data de vencimento (renda fixa). Após isso vira cash. */
  end_date?: string | null;
  /** Yield/dividendo médio mensal pago (não-reinvestido). Apenas pra display. */
  monthly_dividend_yield?: number;
};

export type AssetProjectionParams = {
  id: string;
  /** Retorno mensal esperado (decimal: 0.01 = 1%). LIQUIDO de IR. */
  monthlyExpected: number;
  /** Volatilidade mensal (desvio padrão dos retornos). */
  monthlyVolatility: number;
  /** Data de vencimento. Após isso, retorno = 0. */
  endDate: string | null;
  /** Saldo inicial (current_balance). */
  initialBalance: number;
  /** True pra ativos de mercado (stocks/FIIs/etfs) — sem IR mensal. */
  isMarket: boolean;
};

export type MonteCarloPoint = {
  date: string;
  monthIndex: number;
  p10: number;
  p50: number;
  p90: number;
  /** Trajetória determinística (compounding sem volatilidade), pra referência. */
  expected: number;
};

/** Indexadores atuais em % anual (ex: { selic: 13.5, cdi: 13.4, ipca: 4.2 }) */
export type Indexers = { selic?: number; cdi?: number; ipca?: number };

/* ============================== ASSUMPTIONS ============================== */

/** Taxa de IR sobre rendimento de renda fixa (regressiva, mas user holds > 720 dias = 15%) */
const RF_IR_RATE = 0.15;

/** Retorno anual nominal esperado pra ações (capital appreciation BR histórica, sem dividendos) */
const STOCK_NOMINAL_CAPITAL_RETURN = 0.06; // 6% — conservador, sem reinvestir dividendos

/** Volatilidade anual */
const STOCK_VOLATILITY = 0.25;
const RF_VOLATILITY_SELIC = 0.005; // bem baixa (pós-fixado)
const RF_VOLATILITY_IPCA = 0.025; // moderada (marked-to-market com IPCA)
const RF_VOLATILITY_FIXED = 0.015; // baixa (prefixado pode oscilar com Selic)

/* ============================== PARAMS POR ATIVO ========================= */

/**
 * Calcula os parâmetros de projeção pra um ativo específico, usando os
 * indexadores correntes do mercado.
 */
export function computeAssetParams(
  inv: AssetSnapshot,
  indexers: Indexers,
): AssetProjectionParams {
  const initialBalance = Number(inv.current_balance ?? 0);
  const isStock =
    inv.asset_type === "stock" ||
    inv.asset_type === "fii" ||
    inv.asset_type === "etf";

  // Helper pra converter anual em mensal: (1 + r)^(1/12) - 1
  const annualToMonthly = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;
  // Volatilidade anual → mensal: vol / sqrt(12)
  const annualVolToMonthly = (vol: number) => vol / Math.sqrt(12);

  // ===== Stocks/FIIs/ETFs =====
  if (isStock) {
    return {
      id: inv.id,
      monthlyExpected: annualToMonthly(STOCK_NOMINAL_CAPITAL_RETURN),
      monthlyVolatility: annualVolToMonthly(STOCK_VOLATILITY),
      endDate: null,
      initialBalance,
      isMarket: true,
    };
  }

  // ===== Renda fixa indexada à Selic =====
  if (inv.indexer === "selic" && indexers.selic != null) {
    const multiplier = Number(inv.indexer_multiplier ?? 1);
    const annual = (indexers.selic / 100) * multiplier;
    return {
      id: inv.id,
      monthlyExpected: annualToMonthly(annual) * (1 - RF_IR_RATE),
      monthlyVolatility: annualVolToMonthly(RF_VOLATILITY_SELIC),
      endDate: inv.end_date ?? null,
      initialBalance,
      isMarket: false,
    };
  }

  // ===== Renda fixa indexada ao CDI =====
  if (inv.indexer === "cdi" && indexers.cdi != null) {
    const multiplier = Number(inv.indexer_multiplier ?? 1);
    const annual = (indexers.cdi / 100) * multiplier;
    return {
      id: inv.id,
      monthlyExpected: annualToMonthly(annual) * (1 - RF_IR_RATE),
      monthlyVolatility: annualVolToMonthly(RF_VOLATILITY_SELIC),
      endDate: inv.end_date ?? null,
      initialBalance,
      isMarket: false,
    };
  }

  // ===== IPCA+ (inflação + spread) =====
  if (inv.indexer === "ipca" && indexers.ipca != null) {
    // IPCA vem como % do MÊS (não anual). Anualiza: (1 + ipca_mensal/100)^12 - 1
    const ipcaAnnual = Math.pow(1 + indexers.ipca / 100, 12) - 1;
    const spreadAnnual = Number(inv.fixed_rate ?? 0) / 100;
    const annual = (1 + ipcaAnnual) * (1 + spreadAnnual) - 1;
    return {
      id: inv.id,
      monthlyExpected: annualToMonthly(annual) * (1 - RF_IR_RATE),
      monthlyVolatility: annualVolToMonthly(RF_VOLATILITY_IPCA),
      endDate: inv.end_date ?? null,
      initialBalance,
      isMarket: false,
    };
  }

  // ===== Prefixado =====
  if (inv.indexer === "fixed" && inv.fixed_rate != null) {
    const annual = Number(inv.fixed_rate) / 100;
    return {
      id: inv.id,
      monthlyExpected: annualToMonthly(annual) * (1 - RF_IR_RATE),
      monthlyVolatility: annualVolToMonthly(RF_VOLATILITY_FIXED),
      endDate: inv.end_date ?? null,
      initialBalance,
      isMarket: false,
    };
  }

  // ===== Fallback (cripto, outros): assume Selic com volatilidade média =====
  const selic = (indexers.selic ?? 13.5) / 100;
  return {
    id: inv.id,
    monthlyExpected: annualToMonthly(selic) * (1 - RF_IR_RATE),
    monthlyVolatility: annualVolToMonthly(0.10),
    endDate: inv.end_date ?? null,
    initialBalance,
    isMarket: false,
  };
}

/* ============================== MONTE CARLO ============================== */

/** Box-Muller: gera amostra normal padrão (média 0, dp 1). */
function sampleNormal(): number {
  // Garante u != 0 pra log não dar -Infinity
  let u = Math.random();
  while (u === 0) u = Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Adiciona N meses a uma data YYYY-MM-DD. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export type MonteCarloArgs = {
  assets: AssetProjectionParams[];
  monthsForward: number;
  /** Aporte mensal (em BRL) — distribuído proporcional aos pesos atuais. */
  monthlyContribution: number;
  /** Data de hoje (YYYY-MM-DD) — usada pra checar maturidade. */
  todayDate: string;
  /** Quantidade de simulações (default 500). */
  trials?: number;
};

/**
 * Roda Monte Carlo: pra cada trial, simula trajetória mensal dos ativos com
 * retornos aleatórios sampled de N(μ, σ²). Agrega e retorna percentis por mês.
 *
 * Performance: ~36k operações (500 × 12 × 6 ativos). Roda em < 100ms no browser.
 */
export function runMonteCarlo(args: MonteCarloArgs): MonteCarloPoint[] {
  const trials = args.trials ?? 500;
  const { assets, monthsForward, monthlyContribution, todayDate } = args;

  // Distribuição proporcional dos aportes futuros pela alocação atual
  const totalInitial = assets.reduce((s, a) => s + a.initialBalance, 0);
  const weights = totalInitial > 0
    ? assets.map((a) => a.initialBalance / totalInitial)
    : assets.map(() => 1 / assets.length);

  // Pré-computa datas de cada mês forward
  const monthDates: string[] = [];
  for (let m = 1; m <= monthsForward; m++) {
    monthDates.push(addMonths(todayDate, m));
  }

  // Roda trials — coleta totais por mês
  // trialResults[trial][month] = total portfolio
  const trialResults: number[][] = [];

  for (let t = 0; t < trials; t++) {
    const balances = assets.map((a) => a.initialBalance);
    const monthlyTotals: number[] = [];

    for (let m = 0; m < monthsForward; m++) {
      const monthDate = monthDates[m];

      // Aporte distribuído
      if (monthlyContribution > 0) {
        for (let i = 0; i < balances.length; i++) {
          balances[i] += monthlyContribution * weights[i];
        }
      }

      // Aplica retornos aleatórios por ativo
      for (let i = 0; i < balances.length; i++) {
        const a = assets[i];
        // Maturidade: após end_date, retorno = 0 (cash sitting)
        if (a.endDate && monthDate > a.endDate) continue;
        const z = sampleNormal();
        const r = a.monthlyExpected + a.monthlyVolatility * z;
        balances[i] += balances[i] * r;
      }

      monthlyTotals.push(balances.reduce((s, b) => s + b, 0));
    }

    trialResults.push(monthlyTotals);
  }

  // ===== Trajetória determinística (sem volatilidade) — referência =====
  const expectedTrajectory: number[] = [];
  {
    const detBalances = assets.map((a) => a.initialBalance);
    for (let m = 0; m < monthsForward; m++) {
      const monthDate = monthDates[m];
      if (monthlyContribution > 0) {
        for (let i = 0; i < detBalances.length; i++) {
          detBalances[i] += monthlyContribution * weights[i];
        }
      }
      for (let i = 0; i < detBalances.length; i++) {
        const a = assets[i];
        if (a.endDate && monthDate > a.endDate) continue;
        detBalances[i] += detBalances[i] * a.monthlyExpected;
      }
      expectedTrajectory.push(detBalances.reduce((s, b) => s + b, 0));
    }
  }

  // Computa percentis por mês
  const out: MonteCarloPoint[] = [];
  for (let m = 0; m < monthsForward; m++) {
    const sortedMonth = trialResults.map((trial) => trial[m]).sort((a, b) => a - b);
    const p10 = sortedMonth[Math.floor(0.10 * trials)];
    const p50 = sortedMonth[Math.floor(0.50 * trials)];
    const p90 = sortedMonth[Math.floor(0.90 * trials)];
    out.push({
      date: monthDates[m],
      monthIndex: m + 1,
      p10: Math.round(p10 * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p90: Math.round(p90 * 100) / 100,
      expected: Math.round(expectedTrajectory[m] * 100) / 100,
    });
  }
  return out;
}
