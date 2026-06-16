import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tile de bento: card seco (hairline + 1 step de surface), sem blur pesado. */
export function Tile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[16px] bg-card border border-border shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Rótulo editorial (deck-line) acima de cada bloco. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("eyebrow", className)}>{children}</div>;
}
