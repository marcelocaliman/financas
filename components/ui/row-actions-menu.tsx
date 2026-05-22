"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
 * Menu de ações por linha. Usa Radix DropdownMenu (portal + collision detection +
 * keyboard nav + focus management) — não fica clipado por containers com overflow.
 */
export function RowActionsMenu({
  actions,
  label = "Mais ações",
  align = "end",
}: {
  actions: RowAction[];
  label?: string;
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "p-1.5 rounded-[6px] text-faint-foreground hover:text-foreground hover:bg-surface-muted",
            "data-[state=open]:opacity-100 data-[state=open]:text-foreground data-[state=open]:bg-surface-muted",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500",
          )}
          aria-label={label}
        >
          <MoreHorizontal className="w-4 h-4" strokeWidth={1.7} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-50 min-w-[200px] bg-surface border border-border-strong rounded-[10px] shadow-md py-1",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          )}
        >
          {actions.map((a, idx) => (
            <DropdownMenu.Item
              key={idx}
              disabled={a.disabled}
              onSelect={() => a.onSelect()}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer outline-none",
                "data-[highlighted]:bg-surface-muted",
                "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
                a.danger ? "text-rust-600 dark:text-rust-500" : "text-foreground",
              )}
            >
              {a.icon ? <span className="opacity-70 shrink-0">{a.icon}</span> : null}
              {a.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
