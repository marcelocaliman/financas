import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Eyebrow — pequeno rótulo monoespaçado em caixa alta com tracking generoso.
 *   Ex.: "MAIO · 2026", "PATRIMÔNIO · 12 ATIVOS"
 */
export function Eyebrow({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-faint-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
