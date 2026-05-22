import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";
import { QuickAddProvider } from "@/components/transactions/quick-add-context";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { QuickAddFAB } from "@/components/transactions/quick-add-fab";
import { getCurrentUserContext } from "@/services/auth";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const [accounts, categories] = await Promise.all([
    listAccounts(),
    listCategories(),
  ]);

  const accountsLite = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
  }));
  const categoriesLite = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));

  return (
    <QuickAddProvider>
      <RealtimeBridge />
      <div className="min-h-screen flex">
        <Sidebar
          user={{ name: ctx.profile.display_name, email: ctx.email }}
          householdName={ctx.household.name}
        />
        <div className="flex-1 min-w-0 relative">
          <main className="max-w-[1320px] mx-auto px-5 sm:px-10 lg:px-14 pt-8 pb-28 lg:pb-20">
            {children}
          </main>
          <MobileNav />
        </div>
      </div>
      <AddTransactionDialog accounts={accountsLite} categories={categoriesLite} />
      <QuickAddFAB />
    </QuickAddProvider>
  );
}
