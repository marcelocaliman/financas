"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { setRecurringRulesActiveBatch } from "@/services/recurrences.actions";

export type SectionKey = "receitas" | "despesas" | "transferencias" | "pausadas";

/**
 * Section da página /recorrentes. Recebe a lista de regras já filtradas
 * e renderiza header + linhas (children).
 *
 * Header mostra: chevron (colapsa), rótulo, contagem, total mensal,
 * e botão "Pausar todas / Reativar todas" pra ação em lote.
 *
 * Eventos:
 *  - "recurrences:focus" com detail.key === keyboardId expande e scrolla
 *    pra essa seção (usado pelos atalhos R/D/T/P).
 */
export function RecurrenceSection({
  keyboardId,
  label,
  ruleIds,
  monthlyTotal,
  tone = "neutral",
  defaultOpen = true,
  emoji,
  bulkMode = "pause",
  children,
}: {
  keyboardId: SectionKey;
  label: string;
  ruleIds: string[];
  monthlyTotal: number;
  tone?: "income" | "expense" | "transfer" | "neutral";
  defaultOpen?: boolean;
  emoji?: string;
  /** "pause" = botão pausa todas; "resume" = botão reativa todas (pra Pausadas) */
  bulkMode?: "pause" | "resume";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const count = ruleIds.length;

  // Listener pros atalhos de teclado (R/D/T/P)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ key: SectionKey }>;
      if (ce.detail?.key !== keyboardId) return;
      setOpen(true);
      requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        ref.current?.classList.add("ring-2", "ring-navy-700/40");
        setTimeout(() => {
          ref.current?.classList.remove("ring-2", "ring-navy-700/40");
        }, 800);
      });
    };
    window.addEventListener("recurrences:focus", handler);
    return () => window.removeEventListener("recurrences:focus", handler);
  }, [keyboardId]);

  if (count === 0) return null;

  const totalClass =
    tone === "income"
      ? "text-olive-700 dark:text-olive-500"
      : tone === "expense"
        ? "text-rust-600"
        : "text-foreground";

  const handleBulk = (e: React.MouseEvent) => {
    e.stopPropagation();
    const active = bulkMode === "resume";
    const verb = active ? "Reativar" : "Pausar";
    const verbLow = active ? "reativar" : "pausar";
    if (
      !confirm(
        `${verb} ${count} recorrência${count === 1 ? "" : "s"}? Pode ${verbLow} individualmente depois.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await setRecurringRulesActiveBatch(ruleIds, active);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `${r.updated} recorrência${r.updated === 1 ? "" : "s"} ${active ? "reativada" : "pausada"}${r.updated === 1 ? "" : "s"}.`,
      );
    });
  };

  return (
    <Panel ref={ref} className="!p-0 overflow-hidden transition-shadow">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0",
              !open && "-rotate-90",
            )}
            strokeWidth={2}
          />
          {emoji ? (
            <span className="text-[14px] shrink-0" aria-hidden>
              {emoji}
            </span>
          ) : null}
          <div className="min-w-0">
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
        </button>

        <button
          type="button"
          onClick={handleBulk}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[11.5px] font-medium transition-colors shrink-0",
            "text-muted-foreground hover:text-foreground hover:bg-surface-muted",
            "disabled:opacity-50",
          )}
          aria-label={bulkMode === "resume" ? "Reativar todas" : "Pausar todas"}
        >
          {bulkMode === "resume" ? (
            <>
              <Play className="w-3 h-3" strokeWidth={1.8} />
              Reativar todas
            </>
          ) : (
            <>
              <Pause className="w-3 h-3" strokeWidth={1.8} />
              Pausar todas
            </>
          )}
        </button>
      </div>

      {open ? (
        <div className="px-2 pb-2 space-y-0.5 border-t border-border pt-1">{children}</div>
      ) : null}
    </Panel>
  );
}
