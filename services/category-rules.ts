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
): Promise<{ categoryId: string; ruleId: string; debtId: string | null } | null> {
  if (!description.trim()) return null;
  const supabase = await createClient();
  // Inclui debt_id pra sugerir vinculação automática (ex: parcela autokraft → moto)
  const { data } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => {
              order: (c: string, o: { ascending: boolean }) => Promise<{
                data: Array<{ id: string; pattern: string; category_id: string; debt_id: string | null }> | null;
              }>;
            };
          };
        };
      };
    };
  })
    .from("category_rules")
    .select("id, pattern, category_id, debt_id")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .eq("kind", kind)
    .order("priority", { ascending: false });

  if (!data) return null;
  const haystack = description.toLowerCase();
  for (const rule of data) {
    const needle = rule.pattern.toLowerCase();
    if (haystack.includes(needle)) {
      // Incrementa o contador de aplicações (analytics). Antes setava hits:0,
      // zerando o contador a cada match. Fire-and-forget pra não atrasar o insert.
      void (
        supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>
      )("increment_category_rule_hits", { p_id: rule.id });
      return {
        categoryId: rule.category_id,
        ruleId: rule.id,
        debtId: rule.debt_id,
      };
    }
  }
  return null;
}
