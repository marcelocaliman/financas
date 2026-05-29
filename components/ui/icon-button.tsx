"use client";

import * as React from "react";
import { Tooltip } from "./tooltip";
import { cn } from "@/lib/utils/cn";

/**
 * Botão só de ícone com tooltip automático. Padroniza a estilização e
 * acessibilidade — sempre tem aria-label (a partir do tooltip) e tooltip
 * com o mesmo texto.
 *
 * USO:
 *
 *   <IconButton tooltip="Apagar" onClick={...} tone="danger">
 *     <Trash2 className="w-3.5 h-3.5" />
 *   </IconButton>
 *
 * Tones:
 *   - neutral (default): cinza com hover suave
 *   - active: navy destacado com background
 *   - danger: vermelho com hover
 *   - success: verde-oliva
 */

type Tone = "neutral" | "active" | "danger" | "success";

const TONES: Record<Tone, string> = {
  neutral:
    "text-faint-foreground hover:text-foreground hover:bg-surface-muted",
  active:
    "text-navy-700 dark:text-navy-300 bg-navy-100/40 dark:bg-navy-900/20 hover:bg-navy-100/60 dark:hover:bg-navy-700/30",
  danger: "text-faint-foreground hover:text-rust-600 hover:bg-rust-100/50 dark:hover:bg-rust-700/30",
  success:
    "text-faint-foreground hover:text-olive-700 hover:bg-olive-100/50 dark:hover:bg-olive-700/30",
};

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  tooltip: React.ReactNode;
  tone?: Tone;
  /** Lado do tooltip — default "top" */
  side?: "top" | "bottom" | "left" | "right";
  /** Texto pro aria-label se diferente do tooltip. Default: usa tooltip se for string. */
  ariaLabel?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      tooltip,
      tone = "neutral",
      side = "top",
      ariaLabel,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const aria =
      ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined);
    return (
      <Tooltip content={tooltip} side={side}>
        <button
          ref={ref}
          type={type}
          aria-label={aria}
          className={cn(
            "p-1.5 rounded-[6px] transition-colors disabled:opacity-40 disabled:pointer-events-none",
            TONES[tone],
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </Tooltip>
    );
  },
);
IconButton.displayName = "IconButton";
