import { useEffect, useRef } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useUI } from "@/store/ui";
import { actions } from "@/data/actions";
import type { Currency } from "@/money/currency";

/**
 * Sincroniza a MOEDA PRINCIPAL entre o vault cifrado (AppSettings, fonte da verdade
 * durável/multi-dispositivo) e o useUI (espelho local p/ boot instantâneo).
 *
 * No boot: se o vault já tem uma principal, espelha pro useUI (uma vez), reancorando
 * a exibição. Retorna um setter que grava nos DOIS lugares — use-o em vez do
 * setBaseCurrency cru do useUI pra a escolha viajar com o vault.
 */
export function useMainCurrency(): { baseCurrency: Currency; setMainCurrency: (c: Currency) => void } {
  const settings = useSettings();
  const baseCurrency = useUI((s) => s.baseCurrency);
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = settings.baseCurrency;
    if (hydrated.current || !saved) return;
    hydrated.current = true;
    if (useUI.getState().baseCurrency !== saved) useUI.getState().setBaseCurrency(saved);
  }, [settings.baseCurrency]);

  const setMainCurrency = (c: Currency) => {
    useUI.getState().setBaseCurrency(c); // espelho local instantâneo (+ reancora a visão)
    void actions.putSettings({ baseCurrency: c }); // durável + sincronizado (merge no repo)
  };

  return { baseCurrency, setMainCurrency };
}
