import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback OAuth / magic link.
 * Após a troca do code por sessão, dispara bootstrap_household se ainda não houver perfil.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Garante household + perfil idempotente
  const { data: userData } = await supabase.auth.getUser();
  const meta = (userData.user?.user_metadata ?? {}) as {
    display_name?: string;
    household_name?: string;
  };

  await supabase.rpc("bootstrap_household", {
    p_household_name: meta.household_name ?? "Nosso lar",
    p_display_name: meta.display_name ?? userData.user?.email?.split("@")[0] ?? "Sem nome",
  });

  return NextResponse.redirect(`${origin}${next}`);
}
