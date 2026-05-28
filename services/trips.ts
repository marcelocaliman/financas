import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { Currency } from "@/types/database";
import type {
  Trip,
  TripBudgetItem,
  TripPhoto,
  TripStatus,
} from "@/types/trips";

/**
 * Service layer pra viagens. Centraliza queries com casts seguros (os
 * tipos gerados do Supabase ainda não incluem as tabelas trips/budget/photos
 * porque não regeramos database.ts).
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type AnyBuilder = {
  select: (s: string) => AnyBuilder;
  eq: (c: string, v: unknown) => AnyBuilder;
  is: (c: string, v: unknown) => AnyBuilder;
  in: (c: string, v: unknown[]) => AnyBuilder;
  order: (c: string, opts?: Record<string, unknown>) => AnyBuilder;
  limit: (n: number) => AnyBuilder;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  then: <T>(
    onFulfilled: (v: { data: Record<string, unknown>[] | null; error: unknown }) => T,
  ) => Promise<T>;
};
function table(sb: SupabaseClient, name: string): AnyBuilder {
  return (sb.from as unknown as (n: string) => AnyBuilder)(name);
}

// ----------------------------------------------------------------------
// Read
// ----------------------------------------------------------------------

export async function listTrips(opts?: {
  status?: TripStatus;
}): Promise<Trip[]> {
  const supabase = await createClient();
  let q = table(supabase, "trips")
    .select("*")
    .order("status", { ascending: true })
    .order("start_date", { ascending: false, nullsFirst: false });
  if (opts?.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data as unknown as Trip[]) ?? [];
}

export async function getTrip(id: string): Promise<Trip | null> {
  const supabase = await createClient();
  const { data } = await table(supabase, "trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Trip) ?? null;
}

export async function listTripBudgetItems(tripId: string): Promise<TripBudgetItem[]> {
  const supabase = await createClient();
  const { data } = await table(supabase, "trip_budget_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("position", { ascending: true });
  return (data as unknown as TripBudgetItem[]) ?? [];
}

export async function listTripPhotos(tripId: string): Promise<TripPhoto[]> {
  const supabase = await createClient();
  const { data } = await table(supabase, "trip_photos")
    .select("*")
    .eq("trip_id", tripId)
    .order("position", { ascending: true });
  return (data as unknown as TripPhoto[]) ?? [];
}

/**
 * Resumo de uma viagem com totais agregados (planejado vs realizado).
 */
export type TripSummary = {
  trip: Trip;
  budgetByCategory: Array<{ category: string; planned: number; actual: number }>;
  totalPlanned: number; // em default_currency
  totalActual: number; // em default_currency (convertido)
  txCount: number;
  /** Realizado convertido pra displayCurrency do household (pra cards na lista) */
  totalActualInDisplay: number;
  totalPlannedInDisplay: number;
};

export async function getTripSummary(tripId: string): Promise<TripSummary | null> {
  const trip = await getTrip(tripId);
  if (!trip) return null;
  const [budget, displayCurrency, rates] = await Promise.all([
    listTripBudgetItems(tripId),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  // Carrega tx vinculadas com categoria pra mapear ao orçamento
  const supabase = await createClient();
  type TxRow = {
    amount_account: number;
    currency: Currency;
    category: { name: string } | null;
  };
  const { data: txs } = await table(supabase, "transactions")
    .select("amount_account, currency, category:categories(name)")
    .eq("trip_id", tripId);
  const txList = ((txs as unknown as TxRow[]) ?? []).filter(Boolean);

  // Agrega realizado por categoria (na default_currency da viagem)
  const actualByCategory = new Map<string, number>();
  let totalActualNative = 0;
  for (const t of txList) {
    const catName = t.category?.name ?? "Outros";
    const amountNative = convertOrSame(
      Number(t.amount_account),
      t.currency,
      trip.default_currency,
      rates,
    );
    actualByCategory.set(
      catName,
      (actualByCategory.get(catName) ?? 0) + amountNative,
    );
    totalActualNative += amountNative;
  }

  // Junta planned + actual (linhas só com actual ainda aparecem)
  const allCategories = new Set([
    ...budget.map((b) => b.category),
    ...Array.from(actualByCategory.keys()),
  ]);
  const budgetMap = new Map(budget.map((b) => [b.category, Number(b.planned_amount)]));
  const budgetByCategory = Array.from(allCategories)
    .map((cat) => ({
      category: cat,
      planned: budgetMap.get(cat) ?? 0,
      actual: actualByCategory.get(cat) ?? 0,
    }))
    .sort((a, b) => {
      // Mantém ordem do orçamento; categorias só com gastos ficam por último
      const ai = budget.findIndex((b) => b.category === a.category);
      const bi = budget.findIndex((b) => b.category === b.category);
      if (ai === -1 && bi === -1) return b.actual - a.actual;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  const totalPlanned = budget.reduce((s, b) => s + Number(b.planned_amount), 0);
  const totalActual = totalActualNative;

  return {
    trip,
    budgetByCategory,
    totalPlanned: Math.round(totalPlanned * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    txCount: txList.length,
    totalActualInDisplay:
      Math.round(
        convertOrSame(totalActual, trip.default_currency, displayCurrency, rates) * 100,
      ) / 100,
    totalPlannedInDisplay:
      Math.round(
        convertOrSame(totalPlanned, trip.default_currency, displayCurrency, rates) * 100,
      ) / 100,
  };
}

/**
 * Lista viagens com summary pra renderizar cards na página /viagens.
 */
export async function listTripsWithSummary(): Promise<TripSummary[]> {
  const trips = await listTrips();
  return Promise.all(trips.map((t) => getTripSummary(t.id))).then(
    (s) => s.filter(Boolean) as TripSummary[],
  );
}

/**
 * Gera signed URLs pras fotos (bucket é privado).
 * TTL de 1h é suficiente pro tempo de visualização da página.
 */
export async function getTripPhotoUrls(
  photos: TripPhoto[],
): Promise<Map<string, string>> {
  if (photos.length === 0) return new Map();
  const supabase = await createClient();
  const urls = new Map<string, string>();
  for (const p of photos) {
    const { data } = await supabase.storage
      .from("trip-photos")
      .createSignedUrl(p.storage_path, 3600);
    if (data?.signedUrl) urls.set(p.id, data.signedUrl);
  }
  return urls;
}
