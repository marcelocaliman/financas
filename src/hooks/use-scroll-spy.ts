import { useEffect, useState } from "react";
import { useSections } from "@/store/sections";
import { useUI } from "@/store/ui";

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

/** Rola suavemente até a seção (respeitando a top-bar via scroll-margin no CSS). */
export function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Navega pra uma seção pela nav: ABRE o accordion e rola até o header (que não se move).
 *  Se a Config estiver aberta, fecha-a e adia a rolagem pro AppShell (quando o conteúdo volta). */
export function goToSection(id: string): void {
  useSections.getState().setOpen(id, true);
  if (useUI.getState().configOpen) {
    pendingNav = id;
    useUI.getState().setConfigOpen(false);
  } else {
    scrollToSection(id);
  }
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
