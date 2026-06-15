import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./nav-items";
import { CurrencyToggle } from "./currency-toggle";
import { scrollToSection } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";

/** Menu horizontal no topo (estilo landing clássica) — âncoras + seção ativa. */
export function TopNav({ active }: { active: string }) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 glass border-b border-border">
      <div className="max-w-[1560px] mx-auto px-5 md:px-8 lg:px-12 xl:px-16 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => scrollToSection(NAV_ITEMS[0].id)}
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0b0c0e]">
            <ArrowLeftRight size={16} />
          </div>
          <span className="font-display font-bold text-[16px] tracking-[-0.02em]">{t("app.name")}</span>
        </button>

        <nav className="hidden lg:flex items-center gap-0.5">
          {NAV_ITEMS.map(({ id, key }) => {
            const on = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                  on ? "text-accent" : "text-muted hover:text-text",
                )}
              >
                {t(`nav.${key}`)}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <CurrencyToggle />
        </div>
      </div>
    </header>
  );
}
