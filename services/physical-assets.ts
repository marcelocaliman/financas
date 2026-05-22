import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PhysicalAssetCategory, Tables } from "@/types/database";

export type PhysicalAsset = Tables<"physical_assets">;

// Labels e ícones movidos pra lib/financial/asset-categories.ts (puro, server+client)
export { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/financial/asset-categories";

export async function listPhysicalAssets(opts?: {
  includeArchived?: boolean;
}): Promise<PhysicalAsset[]> {
  const supabase = await createClient();
  let q = supabase
    .from("physical_assets")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("current_value", { ascending: false });
  if (!opts?.includeArchived) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PhysicalAsset[];
}

export type PhysicalAssetsTotals = {
  byCategory: Record<PhysicalAssetCategory, number>;
  total: number;
  count: number;
  /** Soma dos valores de aquisição (apenas bens com `acquired_value > 0`). */
  totalAcquired: number;
  /** Δ absoluto vs aquisição. Positivo = bens valorizaram. */
  delta: number;
  /** Δ percentual sobre aquisição. */
  deltaPct: number | null;
  /** Idade média (em dias) dos bens com `acquired_at` preenchido. */
  averageAgeDays: number | null;
  /** Quantos bens estão sem update há mais de 365 dias (`updated_at`). */
  staleCount: number;
};

export async function getPhysicalAssetsTotals(): Promise<PhysicalAssetsTotals> {
  const assets = await listPhysicalAssets();
  const byCategory = {
    real_estate: 0,
    vehicle: 0,
    electronics: 0,
    furniture: 0,
    jewelry: 0,
    art: 0,
    tools: 0,
    other: 0,
  } as Record<PhysicalAssetCategory, number>;
  let total = 0;
  let totalAcquired = 0;
  let ageSumDays = 0;
  let ageCount = 0;
  let staleCount = 0;
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  for (const a of assets) {
    const v = Number(a.current_value ?? 0);
    byCategory[a.category] += v;
    total += v;
    const acq = Number(a.acquired_value ?? 0);
    if (acq > 0) totalAcquired += acq;
    if (a.acquired_at) {
      ageSumDays += (now - new Date(a.acquired_at).getTime()) / ONE_DAY;
      ageCount += 1;
    }
    if (a.updated_at) {
      const sinceUpdate = (now - new Date(a.updated_at).getTime()) / ONE_DAY;
      if (sinceUpdate > 365) staleCount += 1;
    }
  }
  const delta = total - totalAcquired;
  const deltaPct = totalAcquired > 0 ? delta / totalAcquired : null;
  const averageAgeDays = ageCount > 0 ? Math.round(ageSumDays / ageCount) : null;

  return {
    byCategory,
    total: Math.round(total * 100) / 100,
    totalAcquired: Math.round(totalAcquired * 100) / 100,
    delta: Math.round(delta * 100) / 100,
    deltaPct,
    averageAgeDays,
    staleCount,
    count: assets.length,
  };
}
