"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Card colapsável padrão dos formulários — usado pras seções de "Mais opções" e
 * de IR/IRPF. O header tem fundo CLARO mesmo FECHADO, pra a seção ficar destacada
 * e bem definida; o conteúdo fica sempre montado (escondido via `hidden`), então
 * os campos continuam submetendo quando colapsado.
 *
 * Funciona controlado (passe `open` + `onToggle` — pra resetar ao reabrir o
 * dialog) OU não-controlado (omita os dois e use `defaultOpen`).
 */
export function CollapsibleCard({
  title,
  subtitle,
  open: openProp,
  onToggle,
  defaultOpen = false,
  children,
  contentClassName = "space-y-4",
}: {
  title: React.ReactNode;
  /** Texto secundário, em cinza, depois do título (ex.: "forma de pagamento, dívida, IR"). */
  subtitle?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Classe do container do conteúdo (default: space-y-4). */
  contentClassName?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const toggle = onToggle ?? (() => setInternalOpen((v) => !v));
  return (
    <div className="rounded-[8px] border border-border overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[12.5px] font-medium text-foreground bg-bone-100 dark:bg-ink-800 hover:bg-bone-200/60 dark:hover:bg-ink-700/60 transition-colors"
      >
        <span>
          {title}
          {subtitle ? (
            <span className="text-faint-foreground font-normal"> · {subtitle}</span>
          ) : null}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
        )}
      </button>
      <div
        className={
          open
            ? `px-3 py-3 border-t border-border bg-bone-100 dark:bg-ink-800 ${contentClassName}`
            : "hidden"
        }
      >
        {children}
      </div>
    </div>
  );
}
