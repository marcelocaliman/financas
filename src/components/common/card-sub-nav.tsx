import { useContext, useLayoutEffect, useRef, useState } from "react";
import { SubStickyOffsetContext, useScrollSpy, scrollToCard } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";

export interface CardSubNavItem {
  /** id do elemento-card (âncora) dentro da seção. */
  id: string;
  label: string;
}

/**
 * Sub-navegação STICKY dos cards de uma seção (desktop e mobile): abas com sublinhado que pulam
 * pro card e ACENDEM conforme a rolagem. Gruda logo abaixo do cabeçalho da seção — o offset vem
 * do SubStickyOffsetContext (provido pelo Accordion, que mede o header). Rola de lado se não couber.
 */
export function CardSubNav({ items }: { items: CardSubNavItem[] }) {
  const subTop = useContext(SubStickyOffsetContext);
  const ref = useRef<HTMLDivElement>(null);
  const [navH, setNavH] = useState(45);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setNavH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Card ativo = aquele cujo topo cruzou a linha logo abaixo da sub-nav grudada. A folga (+40)
  // faz o próximo card acender assim que ENTRA sob a sub-nav (cobre o vão entre cards), em vez de
  // manter o anterior "aceso" mesmo já fora de vista.
  const active = useScrollSpy(
    items.map((i) => i.id),
    (subTop ?? 0) + navH + 40,
  );

  return (
    <div
      ref={ref}
      style={subTop != null ? { top: subTop } : undefined}
      className={cn(
        "z-10 flex gap-0.5 overflow-x-auto no-scrollbar border-b border-border bg-bg",
        subTop != null && "sticky",
      )}
    >
      {items.map((it) => {
        const on = active === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => scrollToCard(it.id, (subTop ?? 0) + navH)}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              on ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {it.label}
            {/* sublinhado do ativo, encostado na borda-base do bar */}
            <span className={cn("absolute inset-x-2.5 -bottom-px h-[2px] rounded-full transition-colors", on ? "bg-accent" : "bg-transparent")} />
          </button>
        );
      })}
    </div>
  );
}
