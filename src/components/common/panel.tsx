import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card base: cantos arredondados, sombra sutil, fundo do tema. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-card border border-border shadow-card", className)}>
      {children}
    </div>
  );
}
