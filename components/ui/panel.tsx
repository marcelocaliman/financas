import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Panel — superfície branca sobre o papel bege.
 * Cartão editorial padrão, sem sombra dramática, com borda sutil.
 */
export const Panel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[var(--radius-lg)] bg-surface border border-border",
      "px-7 py-7",
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
Panel.displayName = "Panel";

export function PanelHeader({
  title,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between mb-5", className)}>
      <div>
        <h3 className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        {meta ? (
          <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.05em] mt-1.5">
            {meta}
          </div>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
