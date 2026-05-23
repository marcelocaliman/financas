import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div className="w-full">
      <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground mb-3 font-medium">
        Entrar
      </div>
      <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.035em] font-normal text-foreground">
        Bem-vindo de <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">volta.</em>
      </h1>
      <p className="text-muted-foreground text-[14.5px] mt-2 max-w-[360px]">
        Continue de onde parou. Lance, revise, planeje — tudo no seu ritmo.
      </p>

      <div className="mt-10">
        <LoginForm redirectTo={redirectTo} />
      </div>

      <p className="mt-8 text-[13px] text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="text-foreground font-medium hover:text-navy-700 dark:text-navy-300 transition-colors"
        >
          Criar uma →
        </Link>
      </p>
    </div>
  );
}
