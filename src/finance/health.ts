/**
 * Saúde financeira — módulo PURO e testável. Cada dimensão vira um score 0..1; o composto é a
 * média PONDERADA das dimensões com dados (null = sem dados → ignorada e pesos renormalizados).
 * Pesos e limiares são do usuário (defaults só ponto de partida) — nada fixo.
 */

export type HealthDim = "savings" | "diversification" | "reserve" | "debt" | "goals";
export const HEALTH_DIMS: HealthDim[] = ["savings", "diversification", "reserve", "debt", "goals"];

export const DEFAULT_HEALTH_WEIGHTS: Record<HealthDim, number> = {
  savings: 1,
  diversification: 1,
  reserve: 1,
  debt: 1,
  goals: 1,
};
/** Limiares default (editáveis): taxa de poupança alvo e dívida/ativos onde o score zera. */
export const DEFAULT_SAVINGS_TARGET = 20; // %
export const DEFAULT_MAX_DEBT_RATIO = 100; // % (dívida = 100% dos ativos → score 0)

export interface HealthParts {
  savings: number | null;
  diversification: number | null;
  reserve: number | null;
  debt: number | null;
  goals: number | null;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Poupança: taxa de poupança ÷ alvo, saturando em 1. */
export function savingsScore(savingsRatePct: number, targetPct: number): number {
  if (targetPct <= 0) return savingsRatePct > 0 ? 1 : 0;
  return clamp01(savingsRatePct / targetPct);
}

/** Diversificação por classe: 1 − HHI (Herfindahl). 1 classe → 0; N classes iguais → 1−1/N. */
export function diversificationScore(weights: number[]): number | null {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return null;
  const hhi = weights.reduce((s, w) => {
    const p = Math.max(0, w) / total;
    return s + p * p;
  }, 0);
  return clamp01(1 - hhi);
}

/** Reserva: meses cobertos ÷ meses-alvo, saturando em 1. */
export function reserveScore(monthsCovered: number, targetMonths: number): number {
  if (targetMonths <= 0) return monthsCovered > 0 ? 1 : 0;
  return clamp01(monthsCovered / targetMonths);
}

/** Dívida: 0 dívida → 1; dívida = maxRatio% dos ativos → 0 (linear). */
export function debtScore(debtToAssetsPct: number, maxRatioPct: number): number {
  if (maxRatioPct <= 0) return debtToAssetsPct <= 0 ? 1 : 0;
  return clamp01(1 - debtToAssetsPct / maxRatioPct);
}

/** Metas: progresso médio das metas (0..100 → 0..1). */
export function goalsScore(avgProgressPct: number): number {
  return clamp01(avgProgressPct / 100);
}

/** Score composto 0..100: média ponderada das dimensões COM dados; `null` se nenhuma tem dados/peso. */
export function compositeHealth(parts: HealthParts, weights: Record<HealthDim, number>): number | null {
  let sum = 0;
  let wsum = 0;
  for (const dim of HEALTH_DIMS) {
    const v = parts[dim];
    const w = Math.max(0, weights[dim] ?? 0);
    if (v == null || w <= 0) continue;
    sum += v * w;
    wsum += w;
  }
  if (wsum <= 0) return null;
  return (sum / wsum) * 100;
}
