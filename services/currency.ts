import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildRateMap, type RateMap, SUPPORTED_CURRENCIES } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";

/**
 * Busca o mapa de taxas mais recente disponível no DB.
 * Cacheado por request (React `cache`) para evitar refetch.
 *
 * Estratégia: pegamos a última taxa por (base, quote), independente da data.
 * O cron `/api/cron/update-rates` mantém isso atualizado diariamente.
 */
export const getRateMap = cache(async (): Promise<RateMap> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("currency_rates")
    .select("base, quote, rate, date")
    .order("date", { ascending: false });

  if (error || !data) {
    return buildRateMap([]);
  }

  // Última taxa por par
  const latest = new Map<string, { base: Currency; quote: Currency; rate: number }>();
  for (const r of data) {
    const k = `${r.base}→${r.quote}`;
    if (!latest.has(k)) {
      latest.set(k, { base: r.base, quote: r.quote, rate: Number(r.rate) });
    }
  }
  return buildRateMap(Array.from(latest.values()));
});

/**
 * Mapa de taxas vigentes em uma DATA específica (ou na cotação mais próxima
 * anterior). Útil pro IR: a Receita exige conversão de bens em moeda
 * estrangeira pela cotação BCB de 31/12 do ano-base.
 */
export async function getRateMapAt(
  date: string,
  /** Client opcional (ex.: admin no cron, sem sessão). Default: createClient(). */
  client?: Awaited<ReturnType<typeof createClient>>,
): Promise<RateMap> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("currency_rates")
    .select("base, quote, rate, date")
    .lte("date", date)
    .order("date", { ascending: false });
  if (error || !data) return buildRateMap([]);
  const latest = new Map<string, { base: Currency; quote: Currency; rate: number }>();
  for (const r of data) {
    const k = `${r.base}→${r.quote}`;
    if (!latest.has(k)) {
      latest.set(k, { base: r.base, quote: r.quote, rate: Number(r.rate) });
    }
  }
  return buildRateMap(Array.from(latest.values()));
}

const DISPLAY_CURRENCY_FALLBACK: Currency = "BRL";

/**
 * Lê a moeda de exibição preferida do usuário (`users.preferences.displayCurrency`).
 * Cai pra BRL se ausente/inválida. Não erra se o usuário não estiver logado.
 */
export const getDisplayCurrency = cache(async (): Promise<Currency> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DISPLAY_CURRENCY_FALLBACK;

  const { data } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (data?.preferences ?? {}) as { displayCurrency?: string };
  const dc = prefs.displayCurrency;
  if (dc && SUPPORTED_CURRENCIES.includes(dc as Currency)) {
    return dc as Currency;
  }
  return DISPLAY_CURRENCY_FALLBACK;
});

/**
 * Lê a moeda de comparação do usuário (mostrada abaixo da principal nos
 * cards "main info"). Default = a "oposta" da principal: BRL ↔ EUR; pra
 * USD default é EUR.
 */
export const getComparisonCurrency = cache(async (): Promise<Currency | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (data?.preferences ?? {}) as {
    displayCurrency?: string;
    comparisonCurrency?: string | null;
  };

  // "off" explícito → não mostra comparação
  if (prefs.comparisonCurrency === null || prefs.comparisonCurrency === "off") return null;

  const cc = prefs.comparisonCurrency;
  if (cc && SUPPORTED_CURRENCIES.includes(cc as Currency)) {
    return cc as Currency;
  }

  // Default: oposto natural da principal
  const dc = (prefs.displayCurrency as Currency) ?? DISPLAY_CURRENCY_FALLBACK;
  if (dc === "BRL") return "EUR";
  if (dc === "EUR") return "BRL";
  return "EUR"; // pra USD
});

/**
 * Atualiza a moeda de exibição do usuário logado.
 */
export async function setDisplayCurrency(currency: Currency): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: existing } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  const current = (existing?.preferences ?? {}) as Record<string, unknown>;
  const next = { ...current, displayCurrency: currency };

  const { error } = await supabase.from("users").update({ preferences: next }).eq("id", user.id);
  if (error) throw new Error(error.message);
}

/**
 * Upsert de uma taxa no DB.
 */
export async function upsertRate(input: {
  base: Currency;
  quote: Currency;
  date: string;
  rate: number;
  source: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("currency_rates").upsert(input);
  if (error) throw new Error(error.message);
}
