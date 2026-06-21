/**
 * Monte Carlo do FIRE — módulo PURO e testável (irmão de projection.ts / fire.ts).
 *
 * Em vez de UMA média de retorno (determinístico), sorteia MILHARES de trajetórias com
 * altos e baixos do mercado e reporta a DISTRIBUIÇÃO (percentis) + a PROBABILIDADE de
 * sucesso. Roda 100% no cliente (combina com o E2EE: nenhum número sai do navegador).
 *
 * Tudo em MOEDA DE HOJE: usa o retorno REAL (já descontada a inflação) e compara com o
 * número FIRE, que também está em moeda de hoje — coerente com fire.ts e a linha "valor
 * real" da Projeção. Aportes/saques são constantes em termos reais.
 *
 * Determinismo: o gerador é semeado (mulberry32). Mesma entrada + mesma seed → MESMO
 * resultado. Isso evita o % "dançar" a cada render e torna o módulo testável.
 */

/** PRNG determinístico mulberry32 → uniforme em [0,1). Seed estável = resultado estável. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Amostrador Normal(0,1) por Box–Muller, com cache da segunda variável (gera 2 por vez).
 * Recebe um uniforme `rng` e devolve uma função que entrega gaussianas independentes.
 */
export function gaussianSampler(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rng(); // evita log(0)
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

/** Percentil (0..1) por interpolação linear sobre um array JÁ ordenado crescente. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/** Converte média/volatilidade ANUAIS (decimais) em parâmetros MENSAIS equivalentes. */
function monthlyParams(realAnnualReturn: number, annualVolatility: number) {
  return {
    meanMonthly: Math.pow(1 + realAnnualReturn, 1 / 12) - 1,
    volMonthly: annualVolatility / Math.sqrt(12),
  };
}

/** Banda de percentis (P10/P50/P90) de um ano da simulação. */
export interface MonteCarloBand {
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

function bandsFromYears(byYear: number[][]): MonteCarloBand[] {
  return byYear.map((arr, year) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    return { year, p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
  });
}

const DEFAULT_TRIALS = 4000;

// ───────────────────────────── Fase 1 — ACUMULAÇÃO ─────────────────────────────

export interface AccumulationParams {
  /** Patrimônio investível inicial (moeda de hoje, exibição). */
  initial: number;
  /** Aporte mensal (constante em termos reais). */
  monthlyContribution: number;
  /** Retorno REAL médio anual, decimal (ex.: 0.04). */
  realAnnualReturn: number;
  /** Volatilidade anual dos retornos, decimal (ex.: 0.14). */
  annualVolatility: number;
  /** Horizonte em anos. */
  years: number;
  /** Número FIRE alvo (moeda de hoje). */
  target: number;
  trials?: number;
  seed?: number;
}

export interface AccumulationResult {
  /** Fração de trajetórias que terminam ≥ alvo (0..1). */
  successProb: number;
  /** Banda P10/P50/P90 do patrimônio por ano (0..years). */
  bands: MonteCarloBand[];
  trials: number;
}

/**
 * Probabilidade de o patrimônio investível ALCANÇAR o número FIRE no horizonte — versão
 * estocástica do `yearsToFI`/curva determinística (mesmas entradas + volatilidade).
 */
export function simulateAccumulation(params: AccumulationParams): AccumulationResult {
  const { initial, monthlyContribution, realAnnualReturn, annualVolatility, target } = params;
  const years = Math.max(1, Math.round(params.years));
  const trials = Math.max(1, params.trials ?? DEFAULT_TRIALS);
  const next = gaussianSampler(mulberry32(params.seed ?? 0xc0ffee));
  const { meanMonthly, volMonthly } = monthlyParams(realAnnualReturn, annualVolatility);

  const byYear: number[][] = Array.from({ length: years + 1 }, () => new Array<number>(trials));
  let successes = 0;
  for (let t = 0; t < trials; t++) {
    let bal = initial;
    byYear[0][t] = bal;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        const r = meanMonthly + volMonthly * next();
        bal = bal * Math.max(0, 1 + r) + monthlyContribution;
      }
      byYear[y][t] = bal;
    }
    if (byYear[years][t] >= target) successes++;
  }
  return { successProb: successes / trials, bands: bandsFromYears(byYear), trials };
}

// ───────────────────────────── Fase 2 — DECUMULAÇÃO ─────────────────────────────

export interface DecumulationParams {
  /** Patrimônio no início da aposentadoria (ex.: o número FIRE). */
  initialPortfolio: number;
  /** Gasto anual a sacar (constante em termos reais; moeda de hoje). */
  annualSpending: number;
  /** Retorno REAL médio anual, decimal. */
  realAnnualReturn: number;
  /** Volatilidade anual dos retornos, decimal. */
  annualVolatility: number;
  /** Duração da aposentadoria em anos. */
  years: number;
  trials?: number;
  seed?: number;
}

export interface DecumulationResult {
  /** Fração de trajetórias em que o dinheiro DURA o horizonte inteiro (0..1). */
  survivalProb: number;
  /** Banda P10/P50/P90 do saldo por ano (0..years). */
  bands: MonteCarloBand[];
  trials: number;
}

/**
 * Probabilidade de o patrimônio SUSTENTAR os saques pela aposentadoria inteira (risco de
 * sequência de retornos — o clássico Monte Carlo da regra dos 4%). Saca no início de cada
 * mês e rende o restante; se zera antes do fim, a trajetória "quebrou".
 */
export function simulateDecumulation(params: DecumulationParams): DecumulationResult {
  const { initialPortfolio, annualSpending, realAnnualReturn, annualVolatility } = params;
  const years = Math.max(1, Math.round(params.years));
  const trials = Math.max(1, params.trials ?? DEFAULT_TRIALS);
  const next = gaussianSampler(mulberry32(params.seed ?? 0x5eed5eed));
  const { meanMonthly, volMonthly } = monthlyParams(realAnnualReturn, annualVolatility);
  const monthlyWithdrawal = annualSpending / 12;

  const byYear: number[][] = Array.from({ length: years + 1 }, () => new Array<number>(trials));
  let survived = 0;
  for (let t = 0; t < trials; t++) {
    let bal = initialPortfolio;
    let ruined = false;
    byYear[0][t] = bal;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        if (ruined) continue;
        bal -= monthlyWithdrawal; // saca no início do mês
        if (bal <= 0) {
          bal = 0;
          ruined = true;
          continue;
        }
        const r = meanMonthly + volMonthly * next();
        bal = bal * Math.max(0, 1 + r);
      }
      byYear[y][t] = bal;
    }
    if (!ruined && byYear[years][t] > 0) survived++;
  }
  return { survivalProb: survived / trials, bands: bandsFromYears(byYear), trials };
}
