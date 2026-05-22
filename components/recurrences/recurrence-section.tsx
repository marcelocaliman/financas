"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";

/**
 * Section da página /recorrentes. Recebe a lista de regras já filtradas
 * (por kind ou is_active) e renderiza header + linhas (children).
 *
 * Header mostra: rótulo, contagem, total mensal normalizado em destaque.
 * É colapsável — útil pra "Pausadas" que vem fechada por default.
 */
export function RecurrenceSection({
  label,
  count,
  monthlyTotal,
  tone = "neutral",
  defaultOpen = true,
  emoji,
  children,
}: {
  label: string;
  count: number;
  monthlyTotal: number;
  tone?: "income" | "expense" | "transfer" | "neutral";
  defaultOpen?: boolean;
  emoji?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  const totalClass =
    tone === "income"
      ? "text-olive-700 dark:text-olive-500"
      : tone === "expense"
        ? "text-rust-600"
        : "text-foreground";

  return (
    <Panel className="!p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
            strokeWidth={2}
          />
          {emoji ? <span className="text-[14px]" aria-hidden>{emoji}</span> : null}
          <div className="text-left">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              {label}
            </div>
            <div className="text-[13px] text-muted-foreground font-mono mt-0.5">
              {count} ativa{count === 1 ? "" : "s"}
              {monthlyTotal > 0 ? (
                <>
                  {" · "}
                  <span className={cn("font-medium", totalClass)}>
                    <Money
                      value={monthlyTotal}
                      className="text-[13px] inline-flex !flex-row !items-baseline"
                    />
                    /mês
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      {open ? (
        <div className="px-2 pb-2 space-y-0.5 border-t border-border pt-1">
          {children}
        </div>
      ) : null}
    </Panel>
  );
}
