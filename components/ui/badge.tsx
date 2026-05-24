import * as React from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  neutral: "bg-surface-muted text-muted-foreground",
  // Dark mode: bg mais presente (/35) + texto bem visível + font-semibold
  // pra pills lerem nitidamente contra o tema escuro.
  olive: "bg-olive-100 text-olive-700 dark:bg-olive-700/30 dark:text-olive-100 dark:font-semibold",
  rust: "bg-rust-100 text-rust-700 dark:bg-rust-700/30 dark:text-rust-100 dark:font-semibold",
  gold: "bg-gold-100 text-gold-700 dark:bg-gold-700/30 dark:text-gold-100 dark:font-semibold",
  navy: "bg-navy-100 text-navy-700 dark:bg-navy-700/40 dark:text-[#a8bedf] dark:font-semibold",
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
