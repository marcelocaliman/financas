"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const schema = z.object({
  pattern: z.string().min(2, "Padrão precisa ter ao menos 2 caracteres."),
  categoryId: z.string().uuid("Categoria inválida."),
  kind: z.enum(["income", "expense", "transfer"]).default("expense"),
  priority: z.coerce.number().int().default(0),
});

const updateSchema = schema.extend({ id: z.string().uuid() });

export type CategoryRuleFormState = { ok?: boolean; error?: string };

export async function createCategoryRule(
  _prev: CategoryRuleFormState | undefined,
  formData: FormData,
): Promise<CategoryRuleFormState> {
  const parsed = schema.safeParse({
    pattern: formData.get("pattern"),
    categoryId: formData.get("categoryId"),
    kind: formData.get("kind"),
    priority: formData.get("priority") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("category_rules").insert({
    household_id: ctx.household.id,
    pattern: parsed.data.pattern.trim(),
    category_id: parsed.data.categoryId,
    kind: parsed.data.kind,
    priority: parsed.data.priority,
  });
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

export async function updateCategoryRule(
  _prev: CategoryRuleFormState | undefined,
  formData: FormData,
): Promise<CategoryRuleFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    pattern: formData.get("pattern"),
    categoryId: formData.get("categoryId"),
    kind: formData.get("kind"),
    priority: formData.get("priority") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("category_rules")
    .update({
      pattern: parsed.data.pattern.trim(),
      category_id: parsed.data.categoryId,
      kind: parsed.data.kind,
      priority: parsed.data.priority,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

export async function deleteCategoryRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("category_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

/**
 * Aplica TODAS as regras às transactions já cadastradas que não têm
 * categoria. Útil pra "popular o passado" depois de criar uma regra nova.
 */
export async function applyRulesToUncategorized(): Promise<{
  ok?: boolean;
  matched?: number;
  error?: string;
}> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const [{ data: rules }, { data: txs }] = await Promise.all([
    supabase
      .from("category_rules")
      .select("pattern, category_id, kind")
      .eq("household_id", ctx.household.id)
      .eq("is_active", true)
      .order("priority", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, description, kind")
      .eq("household_id", ctx.household.id)
      .is("category_id", null),
  ]);

  if (!rules || rules.length === 0) return { ok: true, matched: 0 };
  if (!txs || txs.length === 0) return { ok: true, matched: 0 };

  let matched = 0;
  for (const tx of txs) {
    const haystack = (tx.description as string).toLowerCase();
    for (const rule of rules) {
      if (rule.kind !== tx.kind) continue;
      if (haystack.includes((rule.pattern as string).toLowerCase())) {
        await supabase
          .from("transactions")
          .update({ category_id: rule.category_id as string, category_source: "rule" })
          .eq("id", tx.id as string);
        matched++;
        break; // primeira regra que bate ganha
      }
    }
  }

  revalidatePath("/transacoes");
  revalidatePath("/dashboard");
  return { ok: true, matched };
}
