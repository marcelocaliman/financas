import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    "Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). " +
      "Login/sync indisponíveis; o app segue local-first.",
  );
}

/**
 * Client do Supabase (só Auth + RPC do cofre). A anon key é PÚBLICA por design.
 * O dado financeiro NUNCA passa por aqui em claro — só ciphertext via push_vault.
 */
export const supabase = createClient(url ?? "http://localhost", anonKey ?? "public-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const supabaseConfigured = Boolean(url && anonKey);
