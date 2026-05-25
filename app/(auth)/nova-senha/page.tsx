import Link from "next/link";
import type { Metadata } from "next";
import { NovaSenhaClient } from "./client";

export const metadata: Metadata = {
  title: "Definir nova senha",
};

/**
 * Página acessada via link do email de recuperação. O Supabase usa flow
 * IMPLICIT (não PKCE), então a URL chega com `#access_token=...&type=recovery`
 * no hash fragment. Processamento precisa ser client-side — Server Component
 * não enxerga fragment (só o browser).
 *
 * NovaSenhaClient:
 *   1. Lê hash da URL
 *   2. Chama supabase.auth.setSession() com os tokens
 *   3. Mostra form pra nova senha
 *   4. Se hash vazio/inválido → redireciona pra /recuperar-senha?expired=1
 */
export default function NovaSenhaPage() {
  return (
    <div className="w-full">
      <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground mb-3 font-medium">
        Nova senha
      </div>
      <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.035em] font-normal text-foreground">
        Crie uma{" "}
        <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
          nova senha.
        </em>
      </h1>
      <p className="text-muted-foreground text-[14.5px] mt-2 max-w-[380px]">
        Mínimo 8 caracteres. Depois disso você já está logado e vai pro dashboard.
      </p>

      <div className="mt-10">
        <NovaSenhaClient />
      </div>

      <p className="mt-8 text-[13px] text-muted-foreground">
        Mudou de ideia?{" "}
        <Link
          href="/login"
          className="text-foreground font-medium hover:text-navy-700 dark:text-navy-300 transition-colors"
        >
          ← Voltar pro login
        </Link>
      </p>
    </div>
  );
}
