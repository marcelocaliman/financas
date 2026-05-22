import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Movement = Tables<"investment_movements">;

export async function listMovements(investmentId: string): Promise<Movement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_movements")
    .select("*")
    .eq("investment_id", investmentId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Movement[];
}
