import * as React from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  neutral: "bg-surface-muted text-muted-foreground",
  // Dark mode: bg sutil (tint baixa) + texto na cor da paleta -500/-300
  // pra contraste agradável sem clarear demais (convenção do app).
  olive: "bg-olive-100 text-olive-700 dark:bg-olive-700/15 dark:text-olive-500",
  rust: "bg-rust-100 text-rust-700 dark:bg-rust-700/15 dark:text-rust-500",
  gold: "bg-gold-100 text-gold-700 dark:bg-gold-700/15 dark:text-gold-500",
  navy: "bg-navy-100 text-navy-700 dark:bg-navy-700/15 dark:text-navy-300",
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
