import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-teal text-white hover:opacity-90",
  secondary: "border border-border text-text hover:bg-bg",
  danger: "bg-neg text-white hover:opacity-90",
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
        "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] text-[13px] font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        className,
      )}
    />
  );
}
