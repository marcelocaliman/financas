import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Casa tudo exceto:
     *  - _next/static, _next/image: assets internos
     *  - favicon.ico, /icon, /apple-icon: convenções de favicon do Next
     *  - /icons/*: PWA icons (rotas dinâmicas do app)
     *  - manifest.webmanifest, sw.js: PWA
     *  - qualquer arquivo com extensão de imagem
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon$|apple-icon$|icons/|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
