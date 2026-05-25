import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type CategoryRule = Tables<"category_rules"> & {
  category: { id: string; name: string; color: string | null; icon: string | null } | null;
};

export async function listCategoryRules(): Promise<CategoryRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("category_rules")
    .select("*, category:categories(id, name, color, icon)")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CategoryRule[];
}

/**
 * Aplica as regras numa descrição. Retorna o category_id da PRIMEIRA regra
 * que bate (ordenado por priority desc). Null se nenhuma bate.
 *
 * Usado pela createTransaction action (antes do insert) e por import em batch.
 * Faz match case-insensitive substring.
 */
export async function matchCategoryRule(
  description: string,
  kind: "income" | "expense" | "transfer",
  householdId: string,
): Promise<{ categoryId: string; ruleId: string } | null> {
  if (!description.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("category_rules")
    .select("id, pattern, category_id")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .eq("kind", kind)
    .order("priority", { ascending: false });

  if (!data) return null;
  const haystack = description.toLowerCase();
  for (const rule of data) {
    const needle = (rule.pattern as string).toLowerCase();
    if (haystack.includes(needle)) {
      // Incrementa contador async (não bloqueia)
      void supabase
        .from("category_rules")
        .update({ hits: 0 })
        .eq("id", rule.id as string)
        .then(); // RPC seria melhor, mas overhead pequeno
      return { categoryId: rule.category_id as string, ruleId: rule.id as string };
    }
  }
  return null;
}
