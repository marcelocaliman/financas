import { useEffect } from "react";
import { TopNav } from "./top-nav";
import { BottomNav } from "./bottom-nav";
import { NAV_ITEMS } from "./nav-items";
import { OnePage } from "@/app/one-page";
import { ConfigDrawer } from "@/components/config/config-drawer";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { useAppBoot } from "@/hooks/use-app-boot";
import { useUI } from "@/store/ui";

/** Casca: menu horizontal no topo + página editorial única + nav inferior (mobile). */
export function AppShell() {
  const theme = useUI((s) => s.theme);
  const active = useScrollSpy(NAV_ITEMS.map((n) => n.id));
  useAppBoot();

  useEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0a0b0d" : "#fafafa");
  }, [theme]);

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <TopNav active={active} />
      <main>
        <OnePage />
      </main>
      <BottomNav active={active} />
      <ConfigDrawer />
    </div>
  );
}
