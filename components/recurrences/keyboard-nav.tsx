"use client";

import { useEffect, useState } from "react";
import type { SectionKey } from "./recurrence-section";

const KEY_TO_SECTION: Record<string, SectionKey> = {
  r: "receitas",
  d: "despesas",
  t: "transferencias",
  p: "pausadas",
  e: "encerradas",
};

/**
 * Escuta teclas R/D/T/P (sem modificador, sem input focado) e dispara
 * `recurrences:focus` que cada Section observa. Renderiza um hint
 * sutil no rodapé com as teclas disponíveis.
 */
export function RecurrenceKeyboardNav({
  available,
}: {
  available: { receitas: boolean; despesas: boolean; transferencias: boolean; pausadas: boolean; encerradas: boolean };
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ignora se tem modificador ou se foco está num input/textarea
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      const section = KEY_TO_SECTION[key];
      if (!section) return;
      if (!available[section]) return;
      e.preventDefault();
      setActiveKey(key);
      setTimeout(() => setActiveKey(null), 400);
      window.dispatchEvent(new CustomEvent("recurrences:focus", { detail: { key: section } }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [available]);

  const items: Array<{ key: string; label: string; visible: boolean }> = [
    { key: "r", label: "Receitas", visible: available.receitas },
    { key: "d", label: "Despesas", visible: available.despesas },
    { key: "t", label: "Transferências", visible: available.transferencias },
    { key: "p", label: "Pausadas", visible: available.pausadas },
    { key: "e", label: "Encerradas", visible: available.encerradas },
  ];

  const visibleItems = items.filter((i) => i.visible);
  if (visibleItems.length === 0) return null;

  return (
    <div className="mt-8 pt-5 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-mono text-faint-foreground">
      <span className="uppercase tracking-[0.14em] font-medium">Atalhos</span>
      {visibleItems.map((i) => (
        <span key={i.key} className="inline-flex items-center gap-1.5">
          <kbd
            className={`px-1.5 py-0.5 rounded border border-border bg-surface text-foreground font-medium uppercase transition-all ${
              activeKey === i.key ? "bg-navy-700 text-white border-navy-700 scale-110" : ""
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
