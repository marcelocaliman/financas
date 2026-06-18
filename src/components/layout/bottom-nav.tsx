import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./nav-items";
import { toggleSection } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";

/** Navegação inferior (mobile, < md) — âncoras, primeiras 5 seções. */
export function BottomNav({ active }: { active: string }) {
  const { t } = useTranslation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2 glass border-t border-border"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.slice(0, 5).map(({ id, key, icon: Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggleSection(id, on)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 min-h-[44px] justify-center rounded-[10px] text-[10px] transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              on ? "text-accent font-semibold" : "text-muted font-medium",
            )}
          >
            <span
              className={cn(
                "grid place-items-center w-9 h-7 rounded-[9px] transition-colors",
                on && "bg-accent-soft",
              )}
            >
              <Icon size={19} />
            </span>
            <span className="whitespace-nowrap">{t(`nav.${key}`)}</span>
          </button>
        );
      })}
    </nav>
  );
}
