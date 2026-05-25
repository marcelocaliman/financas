import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { NovaSenhaForm } from "./form";

export const metadata: Metadata = {
  title: "Definir nova senha",
};

/**
 * Página acessada via link do email de recuperação. O callback já trocou
 * o code por session — chegamos aqui com usuário autenticado. Se não está
 * autenticado (link expirado, acesso direto), redireciona pro reset.
 */
export default async function NovaSenhaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/recuperar-senha?expired=1");
  }

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
        <NovaSenhaForm />
      </div>

      <p className="mt-8 text-[13px] text-muted-foreground">
        Mudou de ideia?{" "}
        <Link
          href="/dashboard"
          className="text-foreground font-medium hover:text-navy-700 dark:text-navy-300 transition-colors"
        >
          Ir pro dashboard sem alterar
        </Link>
      </p>
    </div>
  );
}
