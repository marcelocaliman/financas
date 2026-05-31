"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Índice de seções da declaração — navegação tipo "abas" sobre as seções
 * ancoradas da página de IR (que era um scroll infinito de 7 seções). Fica
 * sticky no topo, rola suave até a seção e destaca a ativa (scroll-spy).
 */
export interface IrSection {
  id: string;
  label: string;
}

export function IrSectionNav({ sections }: { sections: IrSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // A seção mais próxima do topo visível vence.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (el) {
      setActive(id);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav
      aria-label="Seções da declaração"
      className="sticky top-0 z-20 -mx-4 sm:-mx-10 lg:-mx-14 mb-4 bg-background/90 backdrop-blur-sm border-b border-border"
    >
      <div className="px-4 sm:px-10 lg:px-14 overflow-x-auto">
        <ul className="flex items-center gap-1 py-2 min-w-max">
          {sections.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => go(s.id)}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 text-[12.5px] whitespace-nowrap transition-colors",
                  active === s.id
                    ? "bg-navy-700 text-white"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
