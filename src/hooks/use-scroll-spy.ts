import { createContext, useEffect, useState } from "react";
import { useSections } from "@/store/sections";
import { useUI } from "@/store/ui";

/** Offset (px) que as páginas PROVÊEM p/ os cabeçalhos sticky das seções; undefined = não gruda
 *  (ex.: admin, que não passa provider). Evita o Accordion adivinhar o layout. */
export const StickyOffsetContext = createContext<number | undefined>(undefined);

/** Navegação pendente: quando se sai da Config rumo a uma seção, o AppShell rola até ela
 *  assim que o conteúdo principal volta (a Config fica por cima e some com transição). */
let pendingNav: string | null = null;
export function consumePendingNav(): string | null {
  const id = pendingNav;
  pendingNav = null;
  return id;
}

/**
 * Seção ativa numa página de rolagem única: a última seção cujo topo já cruzou a
 * linha de offset (abaixo da top-bar fixa). Robusto a seções de alturas variadas.
 */
export function useScrollSpy(ids: string[], offsetTop = 130): string {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    if (!ids.length) return;
    const update = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - offsetTop <= 0) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids.join("|"), offsetTop]);

  return active;
}

/** Altura da barra fixa que cobre o topo, conforme o layout — pra a seção encostar no topo
 *  (com uma folga pequena) em vez de ficar atrás da barra ou com um vão grande. */
function topBarOffset(): number {
  if (typeof window === "undefined") return 24;
  const ui = useUI.getState();
  const side = ui.navLayout === "side";
  const desktop = window.innerWidth >= 1024;
  // Ticker de cotações (faixa que oculta, 62px, só desktop): a seção para 1px ABAIXO da faixa —
  // o cabeçalho encosta logo abaixo do ticker e a borda-divisória da seção fica escondida ATRÁS
  // da faixa (nada da tab anterior vaza). base(20) + 41 = 61 = altura da faixa − 1.
  const ticker = desktop && ui.ratesTicker ? 41 : 0;
  if (side) return (desktop ? 20 : 72) + ticker; // lateral: desktop sem barra (só folga); mobile MobileBar(60)+folga
  return 88 + ticker; // TopNav (72) + folga
}

/** Rola suavemente até a seção, parando logo abaixo da barra fixa (ancora no topo, sem vão).
 *  Re-afirma após a expansão do accordion e o mount dos gráficos: o smooth-scroll nativo é
 *  facilmente INTERROMPIDO por reflow (e a seção cresce depois do clique), então sem isso ele
 *  parava no meio da página. Reler o rect.top e rolar de novo cai certinho no topo. */
let scrollToken = 0;
export function scrollToSection(id: string): void {
  const token = ++scrollToken;
  const once = () => {
    if (token !== scrollToken) return; // um clique mais novo assumiu — não re-afirma o antigo
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - topBarOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };
  once();
  setTimeout(once, 340); // após a transição do accordion (300ms)
  setTimeout(once, 640); // após o mount de gráficos pesados / reflow tardio
}

/** Navega pra uma seção pela nav: ABRE o accordion e rola até o header (que não se move).
 *  Se a Config estiver aberta, fecha-a e adia a rolagem pro AppShell (quando o conteúdo volta). */
export function goToSection(id: string): void {
  useUI.getState().setSupportOpen(false); // navegar por uma seção sai da página de Suporte
  useSections.getState().setOpen(id, true);
  if (useUI.getState().configOpen) {
    pendingNav = id;
    useUI.getState().setConfigOpen(false);
  } else {
    scrollToSection(id);
  }
}

/** Clique de nav que ALTERNA a seção pelo próprio menu: se já estamos nela (`active`) e está
 *  aberta, FECHA; senão navega (abre + rola). Assim dá pra abrir E fechar a aba pelo menu. */
export function toggleSection(id: string, active: boolean): void {
  if (active && useSections.getState().open[id]) {
    useSections.getState().setOpen(id, false);
  } else {
    goToSection(id);
  }
}

/**
 * Offset (px) onde o CABEÇALHO STICKY de uma seção deve parar — a altura da barra realmente
 * VISÍVEL fixada no topo daquele layout/breakpoint, SEM folga (o cabeçalho encosta logo abaixo
 * dela): lateral no desktop = só o ticker (a sidebar é à esquerda); lateral no mobile = MobileBar(60);
 * top-nav = header fixo(72) — o ticker fica ATRÁS dele, então não soma.
 *
 * Relação com topBarOffset() (onde o clique de menu ANCORA a seção): PROPOSITALMENTE separados.
 * topBarOffset embute uma FOLGA de respiro no clique (e o tuck de 1px atrás do ticker), enquanto o
 * sticky encosta rente à barra (sem folga = sem conteúdo vazando acima do header grudado). No layout
 * do usuário (lateral+ticker) batem em ~1px; a divergência maior é só em top-nav (que ele não usa).
 * Se um dia unificar, derive AMBOS de uma mesma altura-por-layout — não copie um no outro às cegas.
 */
export function stickyTopOffset(): number {
  if (typeof window === "undefined") return 0;
  const ui = useUI.getState();
  const desktop = window.innerWidth >= 1024;
  if (ui.navLayout !== "side") return 72; // top-nav: header fixo (o ticker fica atrás dele)
  if (!desktop) return 60; // lateral no mobile: MobileBar
  return ui.ratesTicker ? 62 : 0; // lateral no desktop: só o ticker (0 se desligado)
}

/** Offset sticky reativo: recalcula em resize e ao trocar de layout/ticker. */
export function useStickyOffset(): number {
  const navLayout = useUI((s) => s.navLayout);
  const ratesTicker = useUI((s) => s.ratesTicker);
  const [offset, setOffset] = useState(stickyTopOffset);
  useEffect(() => {
    const apply = () => setOffset(stickyTopOffset());
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [navLayout, ratesTicker]);
  return offset;
}

/** True quando a página foi rolada além do limite (header transparente → sólido). */
export function useScrolled(threshold = 40): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
