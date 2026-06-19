import { useEffect } from "react";
import { AdminSideNav, AdminTopBar } from "./admin-nav";
import { AdminPage } from "./admin-page";
import { AdminTicketsView } from "./admin-tickets-app";
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
  const setTicketsView = useAdminUI((s) => s.setTicketsView);
  const ticketsView = useAdminUI((s) => s.ticketsView);
  const navCollapsed = useUI((s) => s.navCollapsed);

  // Sobe ao topo ao abrir e ao trocar entre métricas/tickets.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [ticketsView]);

  // ESC: dos tickets volta pras métricas; das métricas volta pro app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (useAdminUI.getState().ticketsView) setTicketsView(false);
      else setAdminOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setAdminOpen, setTicketsView]);

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AdminSideNav active={active} />
      <AdminTopBar active={active} />
      <main className={cn("pt-[104px] lg:pt-[84px] transition-[padding] duration-200", navCollapsed ? "lg:pl-[92px]" : "lg:pl-[268px]")}>
        {ticketsView ? <AdminTicketsView /> : <AdminPage />}
      </main>
    </div>
  );
}
