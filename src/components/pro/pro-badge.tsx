import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Selinho "Pro" (mono, acento). */
export function ProBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] bg-accent-soft text-accent font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5",
        className,
      )}
    >
      {t("pro.badge")}
    </span>
  );
}
