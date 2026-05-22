import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type HouseholdMember = Pick<
  Tables<"users">,
  "id" | "display_name" | "role"
>;

export async function listHouseholdMembers(): Promise<HouseholdMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, display_name, role")
    .order("role", { ascending: true })
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HouseholdMember[];
}

export type HouseholdInvite = Tables<"household_invites">;

export async function listActiveInvites(): Promise<HouseholdInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_invites")
    .select("*")
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HouseholdInvite[];
}
