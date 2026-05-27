"use client";

/**
 * Devolve "rendimento extra do dia" — sempre 0.
 *
 * No-op intencional desde 2026-05-27. Selic/Tesouro/CDI rendem em
 * incrementos DIÁRIOS na vida real, não por segundo. A animação tick
 * × ratio era ficção visual confusa: fazia o número "voltar" no refresh
 * e divergir do que o broker mostra.
 *
 * O valor do dia em curso JÁ ESTÁ INCLUÍDO no derivedBalance do
 * server-side (today's business progress conta no businessDaysSinceContinuous),
 * então não precisa adicionar nada aqui.
 *
 * Mantido na codebase com a assinatura original pra retrocompat dos call-sites.
 * Eventualmente pode ser removido completamente.
 */
export function useLiveYield(_dailyYield: number, _perSecond?: number) {
  void _dailyYield;
  void _perSecond;
  return { accumulated: 0, mounted: true };
}
