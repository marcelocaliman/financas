import type { Currency } from "./currency";

/**
 * Moeda DEFAULT do usuário novo, derivada do locale do navegador — NÃO fixa em BRL.
 * Só vale antes de o usuário escolher a sua moeda principal (depois, o vault/preferência manda).
 * Mapeia a região do navegador → uma das 4 moedas suportadas; fallback BRL (wedge BR→Itália).
 * 100% client-side e com try/catch total (navigator/Intl podem faltar em teste/SSR).
 */

/** Países da zona do euro (ISO-3166 alpha-2) + microestados que usam o euro. */
const EUROZONE = new Set([
  "AD", "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT",
  "LT", "LU", "LV", "MC", "ME", "MT", "NL", "PT", "SI", "SK", "SM", "VA", "XK",
]);

/** Regiões que usam o dólar americano no dia a dia (principais). */
const USD_REGIONS = new Set(["US", "EC", "SV", "PA", "PR", "GU", "VI", "TC", "BQ", "FM", "MH", "PW", "TL", "ZW"]);

function regionToCurrency(region: string | undefined | null): Currency | undefined {
  if (!region) return undefined;
  const r = region.toUpperCase();
  if (r === "BR") return "BRL";
  if (r === "GB") return "GBP";
  if (EUROZONE.has(r)) return "EUR";
  if (USD_REGIONS.has(r)) return "USD";
  return undefined;
}

/**
 * Deriva a moeda a partir das preferências de idioma do navegador. `Intl.Locale.maximize()`
 * preenche a região mesmo em tags curtas ("it" → "IT", "en" → "US", "pt" → "BR").
 */
export function detectDefaultCurrency(): Currency {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const tags = nav?.languages?.length ? [...nav.languages] : nav?.language ? [nav.language] : [];
    for (const tag of tags) {
      if (!tag) continue;
      const region = new Intl.Locale(tag).maximize().region;
      const cur = regionToCurrency(region);
      if (cur) return cur;
    }
  } catch {
    /* navigator/Intl indisponível — cai no fallback */
  }
  return "BRL";
}
