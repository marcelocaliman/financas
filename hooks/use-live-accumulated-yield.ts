"use client";

/**
 * Devolve rendimento acumulado lifetime — sempre o valor do server.
 *
 * No-op intencional desde 2026-05-27. Selic/Tesouro/CDI não rendem por
 * segundo; o valor com today's fraction já vem incluído no derivedBalance
 * do server-side. Sem animação, sem confusão.
 *
 * Mantido com a assinatura original pra retrocompat.
 */
export function useLiveAccumulatedYield(
  baseAccumulated: number,
  _dailyYield: number,
) {
  void _dailyYield;
  return baseAccumulated;
}
