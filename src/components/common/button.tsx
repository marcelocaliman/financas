import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-[#04140d] hover:brightness-110 shadow-[0_0_18px_-6px_var(--accent)]",
  secondary: "border border-border text-text hover:bg-card-hover",
  danger: "bg-neg text-white hover:brightness-110",
  ghost: "text-muted hover:text-text",
};

/** Botão base do app (primário teal, secundário, perigo, ghost). */
export function Button({
  variant = "primary",
  className,
  ...props
}: { variant?: Variant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] text-[13px] font-semibold transition disabled:opacity-50 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        VARIANTS[variant],
        className,
      )}
    />
  );
}
