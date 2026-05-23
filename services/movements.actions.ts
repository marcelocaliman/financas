"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MovementKind } from "@/types/database";

const schema = z.object({
  investmentId: z.string().uuid(),
  kind: z.enum(["buy", "sell", "dividend"]) as z.ZodType<MovementKind>,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().positive("Quantidade deve ser positiva."),
  unitPrice: z.coerce.number().nonnegative("Preço unitário inválido."),
  fees: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional(),
});

const updateSchema = schema.extend({ id: z.string().uuid() });

export type MovementFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const p = i.path.join(".");
    if (p && !out[p]) out[p] = i.message;
  }
  return out;
}

export async function addMovement(
  _prev: MovementFormState | undefined,
  formData: FormData,
): Promise<MovementFormState> {
  const parsed = schema.safeParse({
    investmentId: formData.get("investmentId"),
    kind: formData.get("kind"),
    date: formData.get("date"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    fees: formData.get("fees") ?? 0,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_investment_movement", {
    p_investment_id: parsed.data.investmentId,
    p_kind: parsed.data.kind,
    p_date: parsed.data.date,
    p_quantity: parsed.data.quantity,
    p_unit_price: parsed.data.unitPrice,
    p_fees: parsed.data.fees,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMovement(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("investment_movements").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Atualiza um movimento existente (corrige valor digitado errado, data, etc).
 *
 * O trigger `tg_recompute_investment_aggregates` roda em UPDATE também — então
 * editar qty/unit_price/fees recalcula `investments.quantity` e
 * `investments.initial_amount` automaticamente, o que atualiza o preço médio
 * sem o usuário precisar apagar e recriar.
 */
export async function updateMovement(
  _prev: MovementFormState | undefined,
  formData: FormData,
): Promise<MovementFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    investmentId: formData.get("investmentId"),
    kind: formData.get("kind"),
    date: formData.get("date"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    fees: formData.get("fees") ?? 0,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  // Pra "sell", precisamos validar que a nova qty não excede o estoque pré-venda.
  // Como o trigger é após UPDATE, validamos manualmente aqui.
  if (parsed.data.kind === "sell") {
    const { data: inv } = await supabase
      .from("investments")
      .select("quantity")
      .eq("id", parsed.data.investmentId)
      .maybeSingle();
    const { data: existing } = await supabase
      .from("investment_movements")
      .select("kind, quantity")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (inv && existing && existing.kind === "sell") {
      // qty disponível = qty atual + qty desta venda (reverter) - nova qty
      const available = Number(inv.quantity ?? 0) + Number(existing.quantity);
      if (parsed.data.quantity > available) {
        return {
          fieldErrors: {
            quantity: `Quantidade insuficiente. Máximo ${available.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}.`,
          },
        };
      }
    }
  }

  const { error } = await supabase
    .from("investment_movements")
    .update({
      kind: parsed.data.kind,
      date: parsed.data.date,
      quantity: parsed.data.quantity,
      unit_price: parsed.data.unitPrice,
      fees: parsed.data.fees,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  return { ok: true };
}
