import { useEffect, useState } from "react";

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
