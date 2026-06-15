import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";
import { NAV_ITEMS } from "./nav-items";
import { useUI } from "@/store/ui";

/** Casca do app: menu lateral (desktop) + barra superior + conteúdo + nav inferior (mobile). */
export function AppShell() {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const { pathname } = useLocation();

  // Aplica o tema na raiz do documento.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const active =
    NAV_ITEMS.find((n) =>
      n.to === "/" ? pathname === "/" : pathname.startsWith(n.to),
    ) ?? NAV_ITEMS[0];
  const label = t(`nav.${active.key}`);
  const isPainel = active.to === "/";
  const title = isPainel ? t("common.hello", { name: "Marcelo" }) : label;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <TopBar eyebrow={label} title={title} />
        <div className="px-5 md:px-8 py-6 max-w-[1080px]">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
