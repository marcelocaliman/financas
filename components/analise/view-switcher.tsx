"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Alterna entre as duas granularidades do Histórico:
 *   "Meses" → insights dos últimos 6 meses (tendência, movers).
 *   "Ano"   → fechamento fiscal do ano (bens declaráveis, proventos, export).
 *
 * Antes eram duas páginas separadas (/analise + /relatorios). Viraram uma só
 * com este seletor — a pergunta "como foi meu dinheiro?" tem uma casa só.
 */
export function ViewSwitcher({ view }: { view: "meses" | "ano" }) {
  const items = [
    { key: "meses" as const, label: "Meses", href: "/analise" },
    { key: "ano" as const, label: "Ano", href: "/analise?view=ano" },
  ];
  return (
    <div className="inline-flex rounded-[8px] border border-border-strong p-0.5 bg-surface">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          className={cn(
            "px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors",
            view === it.key
              ? "bg-navy-700 text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
