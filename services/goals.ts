import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Goal = Tables<"goals"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "current_balance"> | null;
};

export async function listGoals(opts?: { includeArchived?: boolean }): Promise<Goal[]> {
  const supabase = await createClient();
  let q = supabase
    .from("goals")
    .select("*, account:accounts(id,name,current_balance)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (!opts?.includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Goal[];
}

// estimateCompletion movida para lib/financial/projection.ts (pura).
export { estimateCompletion } from "@/lib/financial/projection";
