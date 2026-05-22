"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const KINDS = ["income", "expense", "transfer"] as const;

const createSchema = z.object({
  name: z.string().min(1, "Dê um nome à categoria."),
  kind: z.enum(KINDS),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const updateSchema = createSchema.extend({ id: z.string().uuid() });

export type CategoryFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}

export async function createCategory(
  _prev: CategoryFormState | undefined,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    household_id: ctx.household.id,
    name: parsed.data.name.trim(),
    kind: parsed.data.kind,
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

export async function updateCategory(
  _prev: CategoryFormState | undefined,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name.trim(),
      kind: parsed.data.kind,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

export async function archiveCategory(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_archived: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

export async function restoreCategory(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_archived: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

/**
 * Deleta categoria. Transações que apontam pra ela ficam com category_id = null
 * (FK ON DELETE SET NULL no schema). Use com confiança.
 */
export async function deleteCategory(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  revalidatePath("/transacoes");
  return { ok: true };
}

/**
 * Reordena categorias em lote. Recebe IDs ordenados — escreve sort_order
 * com `position` (1-based) via RPC. Ordem é por kind separadamente — quem
 * chama deve passar apenas IDs do mesmo kind pra não embaralhar.
 */
export async function reorderCategories(
  ids: string[],
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_categories", { p_ids: ids });
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true };
}

/**
 * Consolida duas categorias do mesmo kind. Move todas as transações +
 * regras recorrentes da `sourceId` pra `targetId`, depois arquiva a source.
 * Não deleta — preserva histórico.
 */
export async function mergeCategories(
  sourceId: string,
  targetId: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (sourceId === targetId) return { error: "Origem e destino são iguais." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_categories", {
    p_source_id: sourceId,
    p_target_id: targetId,
  });
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  revalidatePath("/transacoes");
  revalidatePath("/recorrentes");
  return { ok: true };
}
