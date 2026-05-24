import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Lê uma system setting bypassando RLS (service role).
 * Algumas configs precisam ser lidas mesmo sem ser admin (ex: maintenance_mode
 * pra mostrar página de bloqueio).
 */
export const getSystemSetting = cache(
  async (key: string): Promise<Json | null> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return data?.value ?? null;
  },
);

export async function isMaintenanceMode(): Promise<boolean> {
  const v = await getSystemSetting("maintenance_mode");
  return v === true;
}

export async function isSignupEnabled(): Promise<boolean> {
  const v = await getSystemSetting("signup_enabled");
  return v !== false;
}

/**
 * Lista TODAS as settings (admin only).
 */
export async function listSystemSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .order("key");
  if (error) throw error;
  return data ?? [];
}
