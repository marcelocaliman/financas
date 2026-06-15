import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./nav-items";
import { scrollToSection } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";

/** Menu lateral (desktop) — âncoras da página única, com seção ativa. */
export function Sidebar({ active }: { active: string }) {
  const { t } = useTranslation();

  return (
    <aside className="hidden md:flex md:flex-col md:w-[244px] px-3.5 py-6 border-r border-border sticky top-0 h-screen">
      <button
        type="button"
        onClick={() => scrollToSection(NAV_ITEMS[0].id)}
        className="flex items-center gap-2.5 px-2.5 mb-9 text-left"
      >
        <div className="grid place-items-center w-[32px] h-[32px] rounded-[10px] bg-accent text-[#0b0c0e]">
          <ArrowLeftRight size={17} />
        </div>
        <span className="font-display font-bold text-[17px] tracking-[-0.02em]">{t("app.name")}</span>
      </button>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, key, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              className={cn(
                "relative flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[14px] text-left transition-colors",
                on
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-muted font-medium hover:text-text hover:bg-card-hover",
              )}
            >
              {on ? (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent" />
              ) : null}
              <Icon size={18} />
              <span>{t(`nav.${key}`)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
