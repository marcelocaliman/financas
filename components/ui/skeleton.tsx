import { cn } from "@/lib/utils/cn";

/**
 * Skeleton primitivo — bloco animado com cor de surface-muted.
 * Use pra montar silhuetas de loading com a mesma forma do conteúdo final.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[6px] bg-surface-muted",
        className,
      )}
    />
  );
}
