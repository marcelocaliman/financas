import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type CurrentUserContext = {
  authId: string;
  email: string | null;
  profile: Tables<"users">;
  household: Tables<"households">;
};

/**
 * Carrega o usuário logado, seu perfil em `users` e o `households`.
 * Lança se a sessão estiver quebrada (profile ausente para um auth user válido).
 */
export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("*")
    .eq("id", profile.household_id)
    .maybeSingle();

  if (householdError || !household) return null;

  return {
    authId: user.id,
    email: user.email ?? null,
    profile,
    household,
  };
}
