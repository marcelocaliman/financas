import { NavLink } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/** Menu lateral (desktop, md+). */
export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 px-4 py-6 bg-card border-r border-border sticky top-0 h-screen">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-teal flex items-center justify-center shrink-0">
          <ArrowLeftRight size={16} color="#fff" />
        </div>
        <span className="font-bold text-[16px] tracking-[-0.01em]">{t("app.name")}</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-colors",
                isActive
                  ? "bg-teal-soft text-teal font-semibold"
                  : "text-muted font-medium hover:text-text hover:bg-bg",
              )
            }
          >
            <Icon size={18} />
            <span>{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
