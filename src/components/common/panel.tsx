import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card base em vidro fosco: cantos arredondados, hairline, elevação por luz. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[20px] glass border border-border shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
