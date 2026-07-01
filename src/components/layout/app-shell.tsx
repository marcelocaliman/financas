import { useEffect, useRef, useState } from "react";
import { TopNav } from "./top-nav";
import { BottomNav } from "./bottom-nav";
import { SideNav, MobileBar } from "./side-nav";
import { InstallBanner } from "@/components/common/install-banner";
import { NAV_ITEMS, CONFIG_NAV_ITEMS } from "./nav-items";
import { OnePage } from "@/app/one-page";
import Config from "@/pages/config";
import { SupportView } from "@/app/support-app";
import { useScrollSpy, consumePendingNav, scrollToSection } from "@/hooks/use-scroll-spy";
import { useAutoSnapshot } from "@/hooks/use-auto-snapshot";
import { useMainCurrency } from "@/hooks/use-main-currency";
import { useTaxonomyBackfill } from "@/hooks/use-taxonomy-backfill";
import { useCostBackfill } from "@/hooks/use-cost-backfill";
import { useUI } from "@/store/ui";
import { RatesTicker } from "@/components/layout/rates-ticker";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Casca: menu (topo ou lateral) + página editorial única. A Config entra NO LUGAR do
 *  conteúdo principal num SLIDE horizontal (a página sai pra esquerda e some; a Config
 *  desliza da direita) + fade — sem ser um modal flutuante. */
export function AppShell() {
  const theme = useUI((s) => s.theme);
  const navLayout = useUI((s) => s.navLayout);
  const navCollapsed = useUI((s) => s.navCollapsed);
  const configOpen = useUI((s) => s.configOpen);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
  const supportOpen = useUI((s) => s.supportOpen);
  const ratesTicker = useUI((s) => s.ratesTicker);
  // O spy segue o conjunto de seções da VISÃO ativa: as da Config quando ela está aberta
  // (a página fica fora da tela), as da página quando fechada. Assim a nav lateral destaca a
  // seção correta nos dois modos e nunca acende uma seção "fantasma" da outra visão.
  const active = useScrollSpy(
    (configOpen ? CONFIG_NAV_ITEMS : NAV_ITEMS).map((n) => n.id),
  );
  useAutoSnapshot();
  useMainCurrency(); // hidrata a moeda principal do vault (multi-dispositivo) no boot
  useTaxonomyBackfill(); // garante a classe "Bens" nas taxonomias já existentes (1×)
  useCostBackfill(); // preenche "valor aplicado" (qtd × preço médio) dos ativos legados (1×)

  // Analytics próprio: 1 evento "app_open" por sessão de app (anônimo, sem dado financeiro).
  useEffect(() => {
    track("app_open");
  }, []);

  useEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0a0b0d" : "#fafafa");
  }, [theme]);

  // Slide horizontal entre dois "panes": a PÁGINA (esquerda) e a CONFIG (direita). Os DOIS
  // ficam sempre montados (o estado-inicial fora-da-tela já vem pintado, então a 1ª abertura
  // anima de verdade; o estado de cada um é preservado). O alvo (configOpen) fica no fluxo e
  // define a altura; o que está saindo vira overlay absoluto + `inert` (não interage, sai do
  // tab/a11y) durante a transição, pra não empurrar o layout nem capturar foco/clique.
  const [pageShow, setPageShow] = useState(!configOpen);
  const [cfgShow, setCfgShow] = useState(configOpen);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Ao fechar vindo da navegação, a seção pendente é consumida uma vez (decide o destino do scroll).
    const pending = configOpen ? null : consumePendingNav();
    // Reset de scroll INSTANTÂNEO (ignora o scroll-behavior:smooth global) pra não brigar com o
    // slide: abrir → topo; fechar c/ navegação → topo (rola pra seção depois); fechar simples
    // (Voltar ao app) → topo também. Ao trocar entre app e Config sempre começamos no topo.
    const html = document.documentElement;
    const prevSB = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0 });
    html.style.scrollBehavior = prevSB;

    // No próximo frame, viramos os transforms: o alvo entra, o outro sai.
    const r = requestAnimationFrame(() => {
      setCfgShow(configOpen);
      setPageShow(!configOpen);
    });
    // Ao FECHAR vindo da navegação, rola (suave) pra seção pendente quando o slide termina.
    const tm = setTimeout(() => {
      if (pending) scrollToSection(pending);
    }, 460);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(tm);
    };
  }, [configOpen]);

  const side = navLayout === "side";
  const target = configOpen ? "config" : "page";
  const paneBase =
    "transition-[transform,opacity] duration-[440ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none";
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
        {ratesTicker ? <RatesTicker /> : null}
        {supportOpen ? (
          <SupportView />
        ) : (
        <div className="relative overflow-clip min-h-screen view-fade-in">
          {/* PÁGINA — pane da esquerda (sai pra esquerda ao abrir a Config) */}
          <div
            inert={target !== "page"}
            className={cn(
              paneBase,
              target !== "page" && "absolute inset-x-0 top-0 pointer-events-none",
              pageShow ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0",
            )}
          >
            <OnePage />
          </div>
          {/* CONFIG — pane da direita (desliza de fora à direita) */}
          <div
            inert={target !== "config"}
            className={cn(
              paneBase,
              target !== "config" && "absolute inset-x-0 top-0 pointer-events-none",
              cfgShow ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
            )}
          >
            <Config onClose={() => setConfigOpen(false)} />
          </div>
        </div>
        )}
      </main>
      <BottomNav active={active} />
      <InstallBanner />
    </div>
  );
}
