import { cn } from "@/lib/utils/cn";

/**
 * Marca tipográfica de Finanças.
 *  Fraunces itálica com um ponto dourado — discreto, editorial.
 */
export function BrandMark({
  size = "md",
  tone = "light",
  className,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "light" | "dark";
  className?: string;
}) {
  const sizes = {
    sm: "text-[18px]",
    md: "text-[22px]",
    lg: "text-[32px]",
    xl: "text-[44px]",
  };
  const dotSize = {
    sm: "w-[4px] h-[4px]",
    md: "w-[5px] h-[5px]",
    lg: "w-[6px] h-[6px]",
    xl: "w-[8px] h-[8px]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[3px] font-display italic font-normal tracking-[-0.03em] leading-none",
        tone === "dark" ? "text-foreground" : "text-white",
        sizes[size],
        className,
      )}
    >
      <span>finanças</span>
      <span className={cn("inline-block rounded-full bg-gold-600", dotSize[size])} />
    </span>
  );
}
