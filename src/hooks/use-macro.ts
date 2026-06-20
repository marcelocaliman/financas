import { useEffect, useState } from "react";
import type { Currency } from "@/money/currency";

export interface Macro {
  /** Taxa básica de juros do país da moeda (% a.a.). */
  rate: number | null;
  /** Inflação acumulada em 12 meses (%). */
  inflation: number | null;
}

/** Rótulos por país/moeda: `tag` curto (p/ o switch), chave i18n do país + nomes (siglas oficiais)
 *  da taxa e do índice. */
export const MACRO_META: Record<Currency, { tag: string; countryKey: string; rateName: string; cpiName: string; src: string }> = {
  BRL: { tag: "BR", countryKey: "countryBR", rateName: "Selic", cpiName: "IPCA", src: "BCB" },
  EUR: { tag: "EU", countryKey: "countryEA", rateName: "BCE", cpiName: "HICP", src: "BCE · Eurostat" },
  USD: { tag: "US", countryKey: "countryUS", rateName: "Fed funds", cpiName: "CPI", src: "Fed · BLS" },
  GBP: { tag: "UK", countryKey: "countryUK", rateName: "Bank Rate", cpiName: "CPI", src: "BoE · ONS" },
};

// Cache em MÓDULO por moeda — busca uma vez por sessão (o /api/macro já cacheia no edge).
const cache = new Map<Currency, Macro>();
const inflight = new Map<Currency, Promise<Macro>>();

function load(c: Currency): Promise<Macro> {
  const cached = cache.get(c);
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(c);
  if (!p) {
    p = fetch(`/api/macro?c=${c}`)
      .then((r) => (r.ok ? (r.json() as Promise<Macro>) : { rate: null, inflation: null }))
      .then((d) => {
        cache.set(c, d);
        return d;
      })
      .catch(() => ({ rate: null, inflation: null }));
    inflight.set(c, p);
  }
  return p;
}

/** Taxa básica + inflação 12m do PAÍS da moeda (Selic/IPCA, BCE/HICP, Fed/CPI, BoE/CPI).
 *  Segue a moeda de exibição → muda de país conforme o usuário escolhe. `null` enquanto carrega. */
export function useMacro(currency: Currency): Macro | null {
  const [m, setM] = useState<Macro | null>(() => cache.get(currency) ?? null);
  useEffect(() => {
    let alive = true;
    setM(cache.get(currency) ?? null);
    void load(currency).then((d) => {
      if (alive) setM(d);
    });
    return () => {
      alive = false;
    };
  }, [currency]);
  return m;
}
