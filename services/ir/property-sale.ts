import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

// Re-exporta a calculadora pura (pode ser usada no client)
export {
  computeGcap,
  calcProgressiveGcap,
  computeReductionFactorPre88,
  computeReductionFactor96To05,
  type GcapCalculation,
} from "@/lib/financial/gcap-calculator";

export type PropertySaleRow = Tables<"physical_asset_sales"> & {
  assetName?: string | null;
};

export type PropertySaleReport = {
  year: number;
  sales: PropertySaleRow[];
  totalTaxDue: number;
  totalPaid: number;
  totalProfit: number;
};

export async function listPropertySales(
  year: number,
  householdId?: string,
): Promise<PropertySaleReport> {
  const supabase = await createClient();
  const q = supabase
    .from("physical_asset_sales")
    .select("*")
    .gte("sale_date", `${year}-01-01`)
    .lte("sale_date", `${year}-12-31`)
    .order("sale_date", { ascending: false });
  const { data } = householdId ? await q.eq("household_id", householdId) : await q;
  const sales = data ?? [];

  const assetIds = Array.from(new Set(sales.map((s) => s.physical_asset_id)));
  let nameByAsset = new Map<string, string>();
  if (assetIds.length > 0) {
    const { data: assets } = await supabase
      .from("physical_assets")
      .select("id, name")
      .in("id", assetIds);
    nameByAsset = new Map((assets ?? []).map((a) => [a.id, a.name]));
  }

  const enriched: PropertySaleRow[] = sales.map((s) => ({
    ...s,
    assetName: nameByAsset.get(s.physical_asset_id) ?? null,
  }));

  return {
    year,
    sales: enriched,
    totalTaxDue: enriched.reduce((s, x) => s + Number(x.tax_due), 0),
    totalPaid: enriched.filter((s) => s.darf_paid_at).reduce((s, x) => s + Number(x.tax_due), 0),
    totalProfit: enriched.reduce((s, x) => s + Number(x.taxable_profit), 0),
  };
}
