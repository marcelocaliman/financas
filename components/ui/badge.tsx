import * as React from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  neutral: "bg-surface-muted text-muted-foreground",
  olive: "bg-olive-100 text-olive-700",
  rust: "bg-rust-100 text-rust-700",
  gold: "bg-gold-100 text-gold-700",
  navy: "bg-navy-100 text-navy-700 dark:text-navy-300",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full",
        "text-[11.5px] font-medium tracking-[-0.005em]",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}
