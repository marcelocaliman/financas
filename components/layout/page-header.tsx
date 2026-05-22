import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6",
        "pb-7 mb-9 border-b border-border",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint-foreground mb-1.5 font-medium">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-[32px] sm:text-[38px] leading-[1.05] tracking-[-0.035em] font-normal text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground text-[14px] sm:text-[14.5px] mt-1.5 max-w-[560px]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </header>
  );
}
