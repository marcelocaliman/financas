import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/** Navegação inferior (mobile, < md). Primeiras 5 seções. */
export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2 glass border-t border-border"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.slice(0, 5).map(({ to, key, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] transition-colors",
              isActive ? "text-accent font-semibold" : "text-faint font-medium",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "grid place-items-center w-9 h-7 rounded-[9px] transition-colors",
                  isActive && "bg-accent-soft",
                )}
              >
                <Icon size={19} />
              </span>
              <span>{t(`nav.${key}`)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
