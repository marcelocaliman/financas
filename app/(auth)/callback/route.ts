import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Callback de magic link / OAuth.
 *
 * Padrão "bulletproof": criamos a NextResponse de redirect ANTES e anexamos as
 * cookies de sessão direto nela, em vez de confiar na propagação implícita do
 * cookies() store do Next. Isso evita race-conditions onde a sessão é criada
 * mas o cookie não chega no browser, deixando o usuário deslogado em /dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Preparamos a response de redirect já — vamos anexar cookies nela.
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[callback] exchange failed:", exchangeError.message);
    return NextResponse.redirect(
      `${origin}/login?error=exchange_failed&msg=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // Bootstrap idempotente: garante household + perfil + categorias.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    console.error("[callback] no user after exchange");
    return NextResponse.redirect(`${origin}/login?error=no_user_after_exchange`);
  }

  const meta = (userData.user.user_metadata ?? {}) as {
    display_name?: string;
    household_name?: string;
    signup_mode?: "create" | "join";
    invite_code?: string;
  };
  const fallbackName =
    meta.display_name ?? userData.user.email?.split("@")[0] ?? "Sem nome";

  // Se o usuário veio com convite, redime ao invés de criar lar novo.
  if (meta.signup_mode === "join" && meta.invite_code) {
    const { error: redeemError } = await supabase.rpc("redeem_household_invite", {
      p_code: meta.invite_code,
      p_display_name: fallbackName,
    });
    if (redeemError) {
      const msg = redeemError.message.toLowerCase();
      // "already has household" significa que o callback foi disparado duas
      // vezes (refresh, etc) — não é erro real.
      if (!msg.includes("already has household")) {
        console.error("[callback] redeem failed:", redeemError.message);
        return NextResponse.redirect(
          `${origin}/login?error=invite_redeem_failed&msg=${encodeURIComponent(redeemError.message)}`,
        );
      }
    }
  } else {
    const { error: bootstrapError } = await supabase.rpc("bootstrap_household", {
      p_household_name: meta.household_name ?? "Nosso lar",
      p_display_name: fallbackName,
    });
    if (bootstrapError) {
      console.error("[callback] bootstrap failed:", bootstrapError.message);
      // Não bloqueamos: pode já existir (idempotente do lado do RPC).
    }
  }

  console.log(
    `[callback] OK · user=${userData.user.email} · redirecting to ${next}`,
  );
  return response;
}
