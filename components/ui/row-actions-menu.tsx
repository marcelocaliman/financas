"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type RowAction = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/**
 * Pequeno menu de ações por linha. Aparece no hover (opacity-0 group-hover:opacity-100)
 * e abre um popover ancorado.
 */
export function RowActionsMenu({
  actions,
  label = "Mais ações",
  align = "right",
}: {
  actions: RowAction[];
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-[6px] text-faint-foreground hover:text-foreground hover:bg-surface-muted opacity-0 group-hover:opacity-100 data-[open=true]:opacity-100 transition-opacity"
        data-open={open}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4" strokeWidth={1.7} />
      </button>
      {open ? (
        <ul
          role="menu"
          className={cn(
            "absolute z-30 mt-1 min-w-[180px] bg-surface border border-border-strong rounded-[10px] shadow-md py-1",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {actions.map((a, idx) => (
            <li key={idx}>
              <button
                type="button"
                role="menuitem"
                disabled={a.disabled}
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "hover:bg-surface-muted",
                  a.danger ? "text-rust-600" : "text-foreground",
                )}
              >
                {a.icon ? <span className="opacity-70">{a.icon}</span> : null}
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
