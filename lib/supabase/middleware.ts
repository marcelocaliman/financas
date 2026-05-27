import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/callback",
  "/auth",
  "/recuperar-senha",
  "/nova-senha",
  // Endpoints chamados pelo Vercel Cron (sem cookie de user). Cada um faz
  // sua própria auth via header x-vercel-cron ou Authorization: Bearer CRON_SECRET.
  // Sem essa exceção, o middleware redireciona pra /login e o cron nunca roda.
  "/api/cron",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAcceptInvite = pathname.startsWith("/contador/aceitar");

  // Sem sessão tentando entrar em rota privada
  if (!user && !isPublic && !isAcceptInvite && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Com sessão: decide se é contador ou titular pra rotear corretamente
  if (user) {
    // Tenta achar perfil de contador OU titular
    const [{ data: accountantProfile }, { data: userProfile }] = await Promise.all([
      supabase
        .from("accountant_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const isAccountant = !!accountantProfile;
    const isTitular = !!userProfile;
    const inContador = pathname.startsWith("/contador");

    // Em /login ou /cadastro estando logado → manda pra área certa
    if (pathname === "/login" || pathname === "/cadastro" || pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = isAccountant ? "/contador" : "/dashboard";
      return NextResponse.redirect(url);
    }

    // Contador SEM perfil completo tentando navegar fora do onboarding → força onboarding
    if (
      isAccountant === false &&
      isTitular === false &&
      inContador &&
      pathname !== "/contador/onboarding" &&
      !isAcceptInvite
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/contador/onboarding";
      return NextResponse.redirect(url);
    }

    // Contador tentando entrar em rota de app titular → manda pro /contador
    if (isAccountant && !inContador && pathname !== "/configuracoes") {
      const url = request.nextUrl.clone();
      url.pathname = "/contador";
      return NextResponse.redirect(url);
    }

    // Titular tentando entrar em /contador (exceto aceitar convite) → bloqueia
    if (isTitular && inContador && !isAcceptInvite) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
