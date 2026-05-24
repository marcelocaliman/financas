import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, LogOut } from "lucide-react";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { MoneyProvider } from "@/components/ui/money-provider";
import { getCurrentAccountantContext } from "@/services/accountant-auth";
import { createClient } from "@/lib/supabase/server";
import { getRateMap } from "@/services/currency";
import { LogoutButton } from "@/components/accountant/logout-button";

/**
 * Layout do espaço do contador. Visualmente minimalista — só topbar
 * fixa com identidade do contador e link "Sair". Sem sidebar do app,
 * sem QuickAdd, sem nada que sugira que está no app do titular.
 */
export default async function ContadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /contador/aceitar?token=X pode ser acessado por usuário ainda sem perfil
  // (acabou de fazer signup). Não bloqueia aqui — a página decide.
  const ctx = await getCurrentAccountantContext();

  // Se logado mas SEM perfil ainda → onboarding (exceto se já está nele/aceitar)
  // O middleware já cuida disso, mas garantia extra:
  if (user && !ctx) {
    // permite que onboarding/aceitar rendam
  }

  // BRL fixed pra contador (IR é sempre em BRL)
  const rates = await getRateMap().catch(() =>
    ({ rates: new Map(), getRate: () => 1, isAvailable: () => false }) as never,
  );

  return (
    <MoneyProvider displayCurrency="BRL" comparisonCurrency={null} rates={rates}>
      <ConfirmProvider>
        <div className="min-h-screen bg-surface">
          <header className="border-b border-border bg-surface-muted/40 backdrop-blur-sm sticky top-0 z-30">
            <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
              <Link
                href="/contador"
                className="inline-flex items-center gap-2 text-foreground"
              >
                <Landmark className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
                <span className="font-display italic text-[17px] tracking-[-0.015em]">
                  Finanças
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint-foreground px-2 py-0.5 rounded-[4px] bg-navy-700/10 text-navy-700 dark:text-navy-300 font-medium">
                  Contador
                </span>
              </Link>
              <div className="flex items-center gap-4">
                {ctx ? (
                  <div className="text-right">
                    <div className="text-[12.5px] text-foreground font-medium leading-tight">
                      {ctx.profile.full_name}
                    </div>
                    <div className="font-mono text-[10.5px] text-faint-foreground">
                      {ctx.profile.crc_number ?? ctx.email}
                    </div>
                  </div>
                ) : null}
                <LogoutButton />
              </div>
            </div>
          </header>
          <main className="max-w-[1200px] mx-auto px-6 py-8">
            {children}
          </main>
        </div>
      </ConfirmProvider>
    </MoneyProvider>
  );
}
