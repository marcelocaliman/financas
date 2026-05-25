import Link from "next/link";
import type { Metadata } from "next";
import { RecuperarSenhaForm } from "./form";

export const metadata: Metadata = {
  title: "Recuperar senha",
};

export default function RecuperarSenhaPage() {
  return (
    <div className="w-full">
      <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground mb-3 font-medium">
        Recuperar acesso
      </div>
      <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.035em] font-normal text-foreground">
        Esqueceu a{" "}
        <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
          senha?
        </em>
      </h1>
      <p className="text-muted-foreground text-[14.5px] mt-2 max-w-[380px]">
        Coloca seu e-mail e mandamos um link pra você criar uma nova. Validade
        de 1 hora.
      </p>

      <div className="mt-10">
        <RecuperarSenhaForm />
      </div>

      <p className="mt-8 text-[13px] text-muted-foreground">
        Lembrou da senha?{" "}
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
