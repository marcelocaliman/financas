import { convert, type Currency, type RateTable } from "./currency";

/** Posição genérica (ativo ou passivo) p/ o cálculo de variação cambial. */
export interface FxHolding {
  amount: number;
  currency: Currency;
}

export interface FxDriver {
  currency: Currency;
  /** Quanto esta moeda contribuiu pra variação do patrimônio (na moeda de exibição). */
  delta: number;
  /** Variação % da MOEDA contra a exibição (ex.: euro +0,9%) — independe de ser ativo/passivo. */
  pct: number;
}

export interface FxDailyResult {
  /** Variação líquida do patrimônio atribuível SÓ ao câmbio (moeda de exibição). */
  delta: number;
  /** delta ÷ patrimônio de hoje × 100. */
  pct: number;
  /** Patrimônio de hoje na moeda de exibição (denominador do pct). */
  netWorthToday: number;
  /** Por moeda ≠ exibição, ordenado por |contribuição| desc. */
  drivers: FxDriver[];
  /** Existe posição em moeda ≠ exibição que se moveu (gate p/ exibir a linha). */
  hasForeign: boolean;
}

const EPS = 0.005;

/**
 * Variação do patrimônio atribuível SÓ ao câmbio entre dois fechamentos, com as POSIÇÕES
 * CONSTANTES: Σ posição_na_moeda × (taxa_hoje − taxa_anterior), convertido pra moeda de exibição.
 * Ativos somam, passivos subtraem. Posição na própria moeda de exibição não varia (taxa = 1).
 *
 * PURA/testável — sem rede e sem nada a vazar: as taxas são públicas (Frankfurter) e o cálculo
 * roda no dispositivo sobre as posições já descriptografadas (E2EE intacto).
 */
export function fxDailyDelta(
  assets: FxHolding[],
  liabilities: FxHolding[],
  display: Currency,
  today: RateTable,
  prev: RateTable,
): FxDailyResult {
  const byCur = new Map<Currency, number>();
  let netWorthToday = 0;
  const acc = (h: FxHolding, sign: number) => {
    const now = convert(h.amount, h.currency, display, today);
    const before = convert(h.amount, h.currency, display, prev);
    netWorthToday += sign * now;
    byCur.set(h.currency, (byCur.get(h.currency) ?? 0) + sign * (now - before));
  };
  for (const a of assets) acc(a, 1);
  for (const l of liabilities) acc(l, -1);

  let delta = 0;
  const drivers: FxDriver[] = [];
  for (const [currency, d] of byCur) {
    delta += d;
    if (currency !== display && Math.abs(d) >= EPS) {
      const before = convert(1, currency, display, prev);
      const now = convert(1, currency, display, today);
      drivers.push({ currency, delta: d, pct: before > 0 ? (now / before - 1) * 100 : 0 });
    }
  }
  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const pct = Math.abs(netWorthToday) > EPS ? (delta / netWorthToday) * 100 : 0;
  return { delta, pct, netWorthToday, drivers, hasForeign: drivers.length > 0 };
}

/** Variação % de 1 unidade de `from` em `to`, entre dois fechamentos (p/ o card de moedas). */
export function pairChangePct(from: Currency, to: Currency, today: RateTable, prev: RateTable): number {
  const before = convert(1, from, to, prev);
  const now = convert(1, from, to, today);
  return before > 0 ? (now / before - 1) * 100 : 0;
}
