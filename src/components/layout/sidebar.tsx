import { NavLink } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/** Menu lateral (desktop, md+). */
export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="hidden md:flex md:flex-col md:w-[244px] px-3.5 py-6 border-r border-border sticky top-0 h-screen">
      <div className="flex items-center gap-2.5 px-2.5 mb-9">
        <div className="grid place-items-center w-[32px] h-[32px] rounded-[10px] bg-accent text-[#04140d] shadow-[0_0_18px_-4px_var(--accent)]">
          <ArrowLeftRight size={17} />
        </div>
        <span className="font-display font-bold text-[17px] tracking-[-0.02em]">{t("app.name")}</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[14px] transition-colors",
                isActive
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-muted font-medium hover:text-text hover:bg-card-hover",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent" />
                ) : null}
                <Icon size={18} />
                <span>{t(`nav.${key}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
