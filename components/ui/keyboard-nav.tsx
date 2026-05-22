"use client";

import { useEffect, useState } from "react";

export type KeyboardNavItem = {
  /** Letra da tecla (uma só, lowercase). */
  key: string;
  /** Rótulo legível pro hint. */
  label: string;
  /** Identificador que ScrollTarget escuta (string arbitrária). */
  target: string;
  /** Se false, omite do hint e ignora o keypress. */
  available?: boolean;
};

/**
 * Genérico: escuta teclas (sem modificador, sem input focado) e dispara
 * `app:focus` que cada <ScrollTarget> observa. Renderiza um hint sutil
 * no rodapé. Compatível com qualquer página.
 */
export function KeyboardNav({
  eventName = "app:focus",
  items,
}: {
  eventName?: string;
  items: KeyboardNavItem[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const map = items.reduce<Record<string, string>>((acc, i) => {
    if (i.available !== false) acc[i.key] = i.target;
    return acc;
  }, {});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      const targetId = map[key];
      if (!targetId) return;
      e.preventDefault();
      setActive(key);
      setTimeout(() => setActive(null), 400);
      window.dispatchEvent(new CustomEvent(eventName, { detail: { target: targetId } }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [eventName, map]);

  const visibleItems = items.filter((i) => i.available !== false);
  if (visibleItems.length === 0) return null;

  return (
    <div className="mt-8 pt-5 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-mono text-faint-foreground">
      <span className="uppercase tracking-[0.14em] font-medium">Atalhos</span>
      {visibleItems.map((i) => (
        <span key={i.key} className="inline-flex items-center gap-1.5">
          <kbd
            className={`px-1.5 py-0.5 rounded border border-border bg-surface text-foreground font-medium uppercase transition-all ${
              active === i.key ? "bg-navy-700 text-white border-navy-700 scale-110" : ""
            }`}
          >
            {i.key}
          </kbd>
          {i.label}
        </span>
      ))}
    </div>
  );
}
