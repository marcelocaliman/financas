import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";
import { NAV_ITEMS } from "./nav-items";
import { OnePage } from "@/app/one-page";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";

/** Primeiro nome derivado do e-mail (ex.: "marcelo.x@..." → "Marcelo"). */
function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const handle = email.split("@")[0].split(/[._-]/)[0];
  return handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : "";
}

/** Casca: menu lateral (âncora) + barra superior + página editorial única + nav inferior. */
export function AppShell() {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const email = useVault((s) => s.email);
  const active = useScrollSpy(NAV_ITEMS.map((n) => n.id));

  useEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0b0c0e" : "#f3f4f6");
  }, [theme]);

  const item = NAV_ITEMS.find((n) => n.id === active) ?? NAV_ITEMS[0];
  const label = t(`nav.${item.key}`);
  const firstName = nameFromEmail(email);
  const title = item.id === "painel" && firstName ? t("common.hello", { name: firstName }) : label;

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} />
      <main className="flex-1 min-w-0 pb-24 md:pb-10">
        <TopBar eyebrow={label} title={title} />
        <div className="px-5 md:px-8 lg:px-12 xl:px-16 max-w-[1560px] mx-auto w-full">
          <OnePage />
        </div>
      </main>
      <BottomNav active={active} />
    </div>
  );
}
