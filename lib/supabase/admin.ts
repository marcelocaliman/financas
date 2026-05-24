import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase com service_role — BYPASSA TODA RLS.
 *
 * USAR SOMENTE EM CONTEXTOS PROTEGIDOS:
 *   - Cron jobs (api/cron/*)
 *   - Operações de platform admin (após guard isPlatformAdmin)
 *   - LGPD: export/delete de dados próprios do user (validar user_id)
 *
 * Nunca expor ao client. Nunca usar em queries de RLS normal.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client missing env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
