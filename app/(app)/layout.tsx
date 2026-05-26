import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { ConsentBanner } from "@/components/lgpd/consent-banner";
import { hasAcceptedCurrentTerms, TERMS_VERSION, PRIVACY_VERSION } from "@/services/lgpd";
import { isPlatformAdmin } from "@/services/platform-admin";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";
import { QuickAddProvider } from "@/components/transactions/quick-add-context";
import { CommandPalette } from "@/components/ui/command-palette";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { QuickAddFAB } from "@/components/transactions/quick-add-fab";
import { MoneyProvider } from "@/components/ui/money-provider";
import { PrivacyProvider } from "@/components/ui/privacy-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { getCurrentUserContext } from "@/services/auth";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { listFontesPagadoras } from "@/services/fontes-pagadoras";
import { getComparisonCurrency, getDisplayCurrency, getRateMap } from "@/services/currency";
import { getSidebarBadges } from "@/services/sidebar-badges";
import { ensureMaterialized } from "@/services/auto-materialize";
import { listDebts } from "@/services/debts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  // Auto-materializa qualquer ocorrência pendente das regras recorrentes
  // antes de carregar qualquer página. Silencioso, falha graciosamente.
  // Cron diário continua rodando como fallback.
  await ensureMaterialized();

  const [
    accounts,
    categories,
    displayCurrency,
    comparisonCurrency,
    rates,
    badges,
    termsOk,
    isAdmin,
    fontes,
    debts,
  ] = await Promise.all([
    listAccounts(),
    listCategories(),
    getDisplayCurrency(),
    getComparisonCurrency(),
    getRateMap(),
    getSidebarBadges(),
    hasAcceptedCurrentTerms(),
    isPlatformAdmin(),
    listFontesPagadoras().catch(() => []),
    listDebts().catch(() => []),
  ]);

  const accountsLite = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    currency: a.currency,
  }));
  const categoriesLite = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));

  return (
    <MoneyProvider
      displayCurrency={displayCurrency}
      comparisonCurrency={comparisonCurrency}
      rates={rates}
    >
      <PrivacyProvider>
      <ConfirmProvider>
      <QuickAddProvider>
        <RealtimeBridge />
        <div className="min-h-screen flex">
          <Sidebar
            user={{ name: ctx.profile.display_name, email: ctx.email }}
            householdName={ctx.household.name}
            badges={badges}
            isPlatformAdmin={isAdmin}
          />
          <MobileDrawer
            user={{ name: ctx.profile.display_name, email: ctx.email }}
            householdName={ctx.household.name}
            badges={badges}
            isPlatformAdmin={isAdmin}
          />
          <div className="flex-1 min-w-0 relative">
            <main className="max-w-[1320px] mx-auto px-4 sm:px-10 lg:px-14 pt-16 lg:pt-8 pb-28 lg:pb-20">
              {children}
            </main>
            <MobileNav />
          </div>
        </div>
        <AddTransactionDialog
          accounts={accountsLite}
          categories={categoriesLite}
          fontes={fontes.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            cnpj: f.cnpj,
            cpf: f.cpf,
            default_irrf_rate: f.default_irrf_rate,
            default_inss_rate: f.default_inss_rate,
          }))}
          debts={debts.map((d) => ({
            id: d.id,
            description: d.description,
            current_balance: Number(d.current_balance),
          }))}
        />
        <QuickAddFAB />
        <CommandPalette />
        {!termsOk ? (
          <ConsentBanner
            termsVersion={TERMS_VERSION}
            privacyVersion={PRIVACY_VERSION}
          />
        ) : null}
      </QuickAddProvider>
      </ConfirmProvider>
      </PrivacyProvider>
    </MoneyProvider>
  );
}
