import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";
import { NAV_ITEMS } from "./nav-items";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";

/** Primeiro nome derivado do e-mail (ex.: "marcelo.x@..." → "Marcelo"). */
function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const handle = email.split("@")[0].split(/[._-]/)[0];
  return handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : "";
}

/** Casca do app: menu lateral (desktop) + barra superior + conteúdo + nav inferior (mobile). */
export function AppShell() {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const email = useVault((s) => s.email);
  const { pathname } = useLocation();

  // Aplica o tema na raiz do documento + cor da barra do navegador.
  useEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0a1310" : "#f4f6f8");
  }, [theme]);

  const active =
    NAV_ITEMS.find((n) =>
      n.to === "/" ? pathname === "/" : pathname.startsWith(n.to),
    ) ?? NAV_ITEMS[0];
  const label = t(`nav.${active.key}`);
  const isPainel = active.to === "/";
  const firstName = nameFromEmail(email);
  const title = isPainel && firstName ? t("common.hello", { name: firstName }) : label;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-24 md:pb-10">
        <TopBar eyebrow={label} title={title} />
        <div className="px-5 md:px-8 lg:px-12 xl:px-16 py-8 lg:py-10 max-w-[1560px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
