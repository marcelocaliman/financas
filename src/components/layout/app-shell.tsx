import { useEffect, useState } from "react";
import { TopNav } from "./top-nav";
import { BottomNav } from "./bottom-nav";
import { SideNav, MobileBar } from "./side-nav";
import { NAV_ITEMS } from "./nav-items";
import { OnePage } from "@/app/one-page";
import Config from "@/pages/config";
import { useScrollSpy, consumePendingNav, scrollToSection } from "@/hooks/use-scroll-spy";
import { useQuotesSync } from "@/hooks/use-quotes-sync";
import { useAutoSnapshot } from "@/hooks/use-auto-snapshot";
import { useMainCurrency } from "@/hooks/use-main-currency";
import { useTaxonomyBackfill } from "@/hooks/use-taxonomy-backfill";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/** Casca: menu (topo ou lateral) + página editorial única; a Config entra NO LUGAR do
 *  conteúdo principal (slide + fade), sem ser um modal flutuante. */
export function AppShell() {
  const theme = useUI((s) => s.theme);
  const navLayout = useUI((s) => s.navLayout);
  const navCollapsed = useUI((s) => s.navCollapsed);
  const configOpen = useUI((s) => s.configOpen);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
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

  // Conteúdo principal ↔ Config: a Config monta no lugar da página, anima a entrada (sobe +
  // fade) e, ao sair, volta a página e rola pro topo (ou pra seção pendente, vinda da nav).
  const [cfgMounted, setCfgMounted] = useState(configOpen);
  const [cfgShow, setCfgShow] = useState(false);
  useEffect(() => {
    if (configOpen) {
      setCfgMounted(true);
      window.scrollTo({ top: 0 });
      const r = requestAnimationFrame(() => setCfgShow(true));
      return () => cancelAnimationFrame(r);
    }
    setCfgShow(false);
    const t = setTimeout(() => {
      setCfgMounted(false);
      requestAnimationFrame(() => {
        const pending = consumePendingNav();
        if (pending) scrollToSection(pending);
        else window.scrollTo({ top: 0 });
      });
    }, 360);
    return () => clearTimeout(t);
  }, [configOpen]);

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
      <main className={side ? (navCollapsed ? "lg:pl-[92px]" : "lg:pl-[268px]") : undefined}>
        {/* Página principal (escondida enquanto a Config está montada — preserva o estado). */}
        <div className={cfgMounted ? "hidden" : undefined}>
          <OnePage />
        </div>
        {cfgMounted ? (
          <div
            className={cn(
              "transition-[opacity,transform] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
              cfgShow ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
            )}
          >
            <Config onClose={() => setConfigOpen(false)} />
          </div>
        ) : null}
      </main>
      <BottomNav active={active} />
    </div>
  );
}
