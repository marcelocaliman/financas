import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ accountant?: string; email?: string; redirectTo?: string }>;
}) {
  const { accountant, email, redirectTo } = await searchParams;
  const isAccountant = accountant === "1";

  return (
    <div className="w-full">
      <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground mb-3 font-medium">
        {isAccountant ? "Conta de contador" : "Começar"}
      </div>
      <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.035em] font-normal text-foreground">
        {isAccountant ? (
          <>Bem-vindo, <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">contador.</em></>
        ) : (
          <>Vamos abrir o seu <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">lar.</em></>
        )}
      </h1>
      <p className="text-muted-foreground text-[14.5px] mt-2 max-w-[420px]">
        {isAccountant
          ? "Crie sua conta de contador pra acessar dados de IR liberados pelos seus clientes. Sem custo, com audit trail completo."
          : "Em três campos a casa fica de pé. Categorias padrão e contas vêm em seguida."}
      </p>

      <div className="mt-10">
        <SignupForm
          initialMode={isAccountant ? "accountant" : "create"}
          presetEmail={email}
          redirectTo={redirectTo}
        />
      </div>

      <p className="mt-8 text-[13px] text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href={`/login${isAccountant ? "?accountant=1" : ""}${email ? `${isAccountant ? "&" : "?"}email=${encodeURIComponent(email)}` : ""}${redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
          className="text-foreground font-medium hover:text-navy-700 dark:text-navy-300 transition-colors"
        >
          Entrar →
        </Link>
      </p>
    </div>
  );
}
