"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { computeGcap } from "@/services/ir/property-sale";

const EXEMPTION_KINDS = ["unico_imovel_440k", "reaplicacao_residencial", "desapropriacao", "permuta_sem_torna", "none"] as const;

const saleSchema = z.object({
  physicalAssetId: z.string().uuid(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  salePrice: z.coerce.number().positive("Preço de venda obrigatório."),
  acquisitionCost: z.coerce.number().nonnegative(),
  acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  buyerName: z.string().optional().nullable(),
  buyerCpfCnpj: z.string().optional().nullable(),
  // Isenções declaradas
  isUniqueResidencialUnder440k: z.coerce.boolean().optional().default(false),
  willReinvestIn180Days: z.coerce.boolean().optional().default(false),
  reinvestAmount: z.coerce.number().nonnegative().optional(),
  manualExemptionKind: z.enum(EXEMPTION_KINDS).optional(),
  filerId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PropertySaleFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createPropertySale(
  _prev: PropertySaleFormState | undefined,
  formData: FormData,
): Promise<PropertySaleFormState> {
  const parsed = saleSchema.safeParse({
    physicalAssetId: formData.get("physicalAssetId"),
    saleDate: formData.get("saleDate"),
    salePrice: formData.get("salePrice"),
    acquisitionCost: formData.get("acquisitionCost"),
    acquiredAt: formData.get("acquiredAt"),
    buyerName: formData.get("buyerName") || null,
    buyerCpfCnpj: formData.get("buyerCpfCnpj") || null,
    isUniqueResidencialUnder440k: formData.get("isUniqueResidencialUnder440k") === "1",
    willReinvestIn180Days: formData.get("willReinvestIn180Days") === "1",
    reinvestAmount: formData.get("reinvestAmount") || undefined,
    manualExemptionKind: formData.get("manualExemptionKind") || undefined,
    filerId: formData.get("filerId") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // Busca categoria do bem pra decidir o tipo de GCAP
  const { data: asset } = await supabase
    .from("physical_assets")
    .select("category")
    .eq("id", parsed.data.physicalAssetId)
    .maybeSingle();
  const assetKind = asset?.category === "real_estate" ? "real_estate" : "movable";

  // Pra bens móveis, soma vendas no mesmo mês pra checar limite 35k
  let otherMovableSalesSameMonth = 0;
  if (assetKind === "movable") {
    const monthStart = parsed.data.saleDate.slice(0, 7) + "-01";
    const monthEnd = parsed.data.saleDate.slice(0, 7) + "-31";
    const { data: otherSales } = await supabase
      .from("physical_asset_sales")
      .select("sale_price, physical_asset_id")
      .eq("household_id", ctx.household.id)
      .gte("sale_date", monthStart)
      .lte("sale_date", monthEnd);
    otherMovableSalesSameMonth = (otherSales ?? [])
      .filter((s) => s.physical_asset_id !== parsed.data.physicalAssetId)
      .reduce((sum, s) => sum + Number(s.sale_price), 0);
  }

  // Calcula GCAP usando o helper
  const gcap = computeGcap({
    salePrice: parsed.data.salePrice,
    acquisitionCost: parsed.data.acquisitionCost,
    acquiredAt: parsed.data.acquiredAt,
    saleDate: parsed.data.saleDate,
    assetKind,
    isUniqueResidencialUnder440k: parsed.data.isUniqueResidencialUnder440k,
    willReinvestIn180Days: parsed.data.willReinvestIn180Days,
    reinvestAmount: parsed.data.reinvestAmount,
    otherMovableSalesSameMonth,
  });
  const { error } = await supabase.from("physical_asset_sales").insert({
    household_id: ctx.household.id,
    physical_asset_id: parsed.data.physicalAssetId,
    sale_date: parsed.data.saleDate,
    sale_price: parsed.data.salePrice,
    acquisition_cost: parsed.data.acquisitionCost,
    gross_profit: gcap.grossProfit,
    reduction_factor_pre_88: gcap.reductionFactorPre88,
    reduction_factor_96_05: gcap.reductionFactor96To05,
    taxable_profit: gcap.taxableProfit,
    tax_due: gcap.taxDue,
    exemption_kind: parsed.data.manualExemptionKind ?? gcap.exemption.kind,
    exemption_notes: gcap.exemption.reason || null,
    darf_due_date: gcap.darfDueDate,
    filer_id: parsed.data.filerId || null,
    buyer_name: parsed.data.buyerName?.trim() || null,
    buyer_cpf_cnpj: parsed.data.buyerCpfCnpj?.replace(/\D/g, "") || null,
    notes: parsed.data.notes?.trim() || null,
  });
  if (error) return { error: error.message };

  // Marca o physical_asset como inativo (vendido)
  await supabase
    .from("physical_assets")
    .update({ is_active: false })
    .eq("id", parsed.data.physicalAssetId);

  revalidatePath("/patrimonio");
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function markPropertySaleDarfPaid(
  id: string,
  paymentReference?: string,
): Promise<PropertySaleFormState> {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { error } = await supabase
    .from("physical_asset_sales")
    .update({
      darf_paid_at: today,
      darf_payment_reference: paymentReference?.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function deletePropertySale(id: string): Promise<PropertySaleFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("physical_asset_sales").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ir", "layout");
  return { ok: true };
}
