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
  for (const a of assets) {
    const v = Number(a.current_value ?? 0);
    byCategory[a.category] += v;
    total += v;
  }
  return { byCategory, total: Math.round(total * 100) / 100, count: assets.length };
}
