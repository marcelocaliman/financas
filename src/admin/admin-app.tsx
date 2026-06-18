import { useEffect } from "react";
import { AdminSideNav, AdminTopBar } from "./admin-nav";
import { AdminPage } from "./admin-page";
import { ADMIN_NAV_ITEMS } from "./nav-items";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { useAdminUI } from "@/store/admin-ui";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * Shell do painel super-admin. Substitui o app do usuário enquanto aberto (não mexe na
 * animação delicada da Config). Reusa o design system: rail lateral (lg) / barra de abas
 * (mobile) + hero + accordions — mesma cara do app, só que pro dono.
 */
export function AdminApp() {
  const active = useScrollSpy(ADMIN_NAV_ITEMS.map((n) => n.id), 100);
  const setAdminOpen = useAdminUI((s) => s.setAdminOpen);
  const navCollapsed = useUI((s) => s.navCollapsed);

  // Começa do topo ao abrir; ESC volta pro app.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAdminOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setAdminOpen]);

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AdminSideNav active={active} />
      <AdminTopBar active={active} />
      <main className={cn("pt-[104px] lg:pt-4 transition-[padding] duration-200", navCollapsed ? "lg:pl-[92px]" : "lg:pl-[268px]")}>
        <AdminPage />
      </main>
    </div>
  );
}
