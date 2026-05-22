import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default function CadastroPage() {
  return (
    <div className="w-full">
      <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground mb-3 font-medium">
        Começar
      </div>
      <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.035em] font-normal text-foreground">
        Vamos abrir o seu <em className="not-italic font-display italic text-navy-700">lar.</em>
      </h1>
      <p className="text-muted-foreground text-[14.5px] mt-2 max-w-[360px]">
        Em três campos a casa fica de pé. Categorias padrão e contas vêm em seguida.
      </p>

      <div className="mt-10">
        <SignupForm />
      </div>

      <p className="mt-8 text-[13px] text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="text-foreground font-medium hover:text-navy-700 transition-colors"
        >
          Entrar →
        </Link>
      </p>
    </div>
  );
}
