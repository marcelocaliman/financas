import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKind, Tables } from "@/types/database";

export type Category = Tables<"categories">;

export async function listCategories(opts?: {
  kind?: CategoryKind;
  includeArchived?: boolean;
}): Promise<Category[]> {
  const supabase = await createClient();
  let q = supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (opts?.kind) q = q.eq("kind", opts.kind);
  if (!opts?.includeArchived) q = q.eq("is_archived", false);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getCategory(id: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("id", id).maybeSingle();
  return (data as Category) ?? null;
}
