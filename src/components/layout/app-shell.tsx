import { useEffect } from "react";
import { TopNav } from "./top-nav";
import { BottomNav } from "./bottom-nav";
import { SideNav, MobileBar } from "./side-nav";
import { NAV_ITEMS } from "./nav-items";
import { OnePage } from "@/app/one-page";
import { ConfigDrawer } from "@/components/config/config-drawer";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { useQuotesSync } from "@/hooks/use-quotes-sync";
import { useAutoSnapshot } from "@/hooks/use-auto-snapshot";
import { useMainCurrency } from "@/hooks/use-main-currency";
import { useTaxonomyBackfill } from "@/hooks/use-taxonomy-backfill";
import { useUI } from "@/store/ui";

/** Casca: menu horizontal no topo + página editorial única + nav inferior (mobile). */
export function AppShell() {
  const theme = useUI((s) => s.theme);
  const navLayout = useUI((s) => s.navLayout);
  const navCollapsed = useUI((s) => s.navCollapsed);
  const active = useScrollSpy(NAV_ITEMS.map((n) => n.id));
  useQuotesSync();
  useAutoSnapshot();
  useMainCurrency(); // hidrata a moeda principal do vault (multi-dispositivo) no boot
  useTaxonomyBackfill(); // garante a classe "Bens" nas taxonomias já existentes (1×)

  useEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0a0b0d" : "#fafafa");
  }, [theme]);

  const side = navLayout === "side";
  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      {side ? (
        <>
          <SideNav active={active} />
          <MobileBar />
        </>
      ) : (
        <TopNav active={active} />
      )}
      {/* No layout lateral, o conteúdo abre espaço pro painel à esquerda (lg+) — menos se recolhido. */}
      <main className={side ? (navCollapsed ? "lg:pl-[92px]" : "lg:pl-[268px]") : undefined}>
        <OnePage />
      </main>
      <BottomNav active={active} />
      <ConfigDrawer />
    </div>
  );
}
