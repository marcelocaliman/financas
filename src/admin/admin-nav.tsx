import {
  ArrowLeftRight, ArrowLeft, Sun, Moon, Lock, LogOut, ShieldCheck, LifeBuoy,
  PanelLeftClose, PanelLeftOpen, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ADMIN_NAV_ITEMS } from "./nav-items";
import { useTicketsUnread } from "./use-realtime";
import { NavList } from "@/components/layout/side-nav";
import { goToSection, toggleSection } from "@/hooks/use-scroll-spy";
import { useAdminUI } from "@/store/admin-ui";
import { useUI } from "@/store/ui";
import { useSections } from "@/store/sections";
import { useVault } from "@/vault/vault-store";
import { Eyebrow } from "@/components/common/tile";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  overview: "Visão geral",
  users: "Usuários",
  analytics: "Analytics",
  access: "Acessos & logs",
  admins: "Administradores",
  flags: "Flags",
  ads: "Ads",
};

function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}

/** Rail lateral do painel (lg+): marca + seções (abrir/fechar individual e TUDO) +
 *  recolher pra só ícones + rodapé fixo. Mesmo molde e funcionalidades do menu do usuário. */
export function AdminSideNav({ active }: { active: string }) {
  const { t } = useTranslation();
  const collapsed = useUI((s) => s.navCollapsed);
  const setCollapsed = useUI((s) => s.setNavCollapsed);
  const close = useAdminUI((s) => s.setAdminOpen);
  const setTicketsView = useAdminUI((s) => s.setTicketsView);
  const ticketsView = useAdminUI((s) => s.ticketsView);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);
  const openSections = useSections((s) => s.open);
  const setSectionOpen = useSections((s) => s.setOpen);
  const setManySections = useSections((s) => s.setMany);
  const ticketsUnread = useTicketsUnread();
  const name = nameFromEmail(email);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  const sectionIds = ADMIN_NAV_ITEMS.map((n) => n.id);
  const allOpen = sectionIds.length > 0 && sectionIds.every((id) => openSections[id]);
  const items = ADMIN_NAV_ITEMS.map((n) => ({ id: n.id, label: LABEL[n.key], Icon: n.icon, isSection: true }));

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed left-4 top-4 z-40 rounded-[20px] bg-card border border-border shadow-[var(--shadow-float)] h-[calc(100vh-2rem)] overflow-hidden transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[244px]",
      )}
    >
      {/* Topo rolável */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-subtle">
        {/* Marca + recolher */}
        <div className={cn("flex shrink-0 px-3 pt-4 pb-3", collapsed ? "flex-col items-center gap-2.5" : "items-center justify-between")}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
              <ShieldCheck size={16} strokeWidth={2.4} />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <div className="font-semibold text-[14.5px] tracking-[-0.02em] leading-none truncate">Painel</div>
                <div className="text-[10.5px] text-faint mt-0.5">administração</div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? t("menu.expand") : t("menu.collapse")}
            title={collapsed ? t("menu.expand") : t("menu.collapse")}
            className="grid place-items-center w-8 h-8 rounded-[9px] text-faint hover:text-text hover:bg-card-hover transition-colors shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        {/* Cabeçalho das seções + abrir/fechar TODAS num clique */}
        <div className={cn("flex items-center shrink-0", collapsed ? "justify-center px-2 mb-1" : "justify-between px-3 mt-1 mb-1.5")}>
          {!collapsed ? <Eyebrow>{t("menu.sections")}</Eyebrow> : null}
          <button
            type="button"
            onClick={() => setManySections(sectionIds, !allOpen)}
            aria-label={allOpen ? t("menu.collapseAll") : t("menu.expandAll")}
            title={allOpen ? t("menu.collapseAll") : t("menu.expandAll")}
            className="grid place-items-center w-7 h-7 rounded-[8px] text-faint hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {allOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
          </button>
        </div>

        {/* Navegação — abrir/fechar cada seção pela seta (mesmo NavList do app) */}
        <NavList items={items} collapsed={collapsed} active={ticketsView ? "" : active} openSections={openSections} onNavigate={(id) => { setTicketsView(false); goToSection(id); }} onToggle={setSectionOpen} />
      </div>

      {/* Rodapé fixo no fim do menu */}
      <div className={cn("shrink-0 p-3 pt-3 border-t border-border", collapsed && "flex flex-col items-center gap-1.5")}>
        {collapsed ? (
          <>
            <IconBtn onClick={() => setTicketsView(true)} label="Tickets" badge={ticketsUnread}><LifeBuoy size={16} /></IconBtn>
            <IconBtn onClick={() => close(false)} label="Voltar ao app"><ArrowLeft size={16} /></IconBtn>
            <IconBtn onClick={toggleTheme} label="Tema">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</IconBtn>
            <div className="h-px w-7 bg-border my-0.5" />
            <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-[#0A0B0D] text-[12px] font-bold" title={email ?? ""}>{initial}</span>
            <IconBtn onClick={lock} label="Trancar"><Lock size={16} /></IconBtn>
            <IconBtn onClick={() => void signOut()} label="Sair"><LogOut size={16} /></IconBtn>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setTicketsView(true)}
              className={cn(
                "relative w-full flex items-center gap-3 h-10 px-3 mb-1 rounded-[11px] text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                ticketsView ? "text-accent bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
              )}
            >
              <LifeBuoy size={17} className="shrink-0" /> <span className="truncate">Tickets</span>
              {ticketsUnread > 0 ? (
                <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-accent text-[#0A0B0D] text-[10px] font-bold tabular leading-none">{ticketsUnread}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => close(false)}
              className="w-full flex items-center gap-3 h-10 px-3 rounded-[11px] text-[13.5px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <ArrowLeft size={17} className="shrink-0" /> Voltar ao app
            </button>
            <div className="mt-2.5 pt-3 border-t border-border">
              <div className="flex items-center gap-2.5 px-1">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-[#0A0B0D] text-[13px] font-bold shrink-0">{initial}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate leading-tight">{name || "Admin"}</div>
                  {email ? <div className="text-[11px] text-faint truncate mt-0.5">{email}</div> : null}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={toggleTheme} aria-label="Tema" className="shrink-0 grid place-items-center w-9 h-9 rounded-[9px] border border-border text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button type="button" onClick={lock} className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  <Lock size={14} className="shrink-0" /> Trancar
                </button>
                <button type="button" onClick={() => void signOut()} className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-neg hover:bg-card-hover transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  <LogOut size={14} className="shrink-0" /> Sair
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/** Botão só-ícone do rodapé recolhido. */
function IconBtn({ onClick, label, badge = 0, children }: { onClick: () => void; label: string; badge?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge > 0 ? `${label} (${badge})` : label}
      title={label}
      className="relative grid place-items-center w-9 h-9 rounded-[10px] border border-border text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {children}
      {badge > 0 ? <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-card" /> : null}
    </button>
  );
}

/** Barra superior do painel no mobile (<lg): marca + voltar + abas horizontais roláveis. */
export function AdminTopBar({ active }: { active: string }) {
  const close = useAdminUI((s) => s.setAdminOpen);
  const setTicketsView = useAdminUI((s) => s.setTicketsView);
  const ticketsView = useAdminUI((s) => s.ticketsView);
  const ticketsUnread = useTicketsUnread();
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="flex items-center justify-between gap-3 h-[54px] px-4">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center w-[26px] h-[26px] rounded-[8px] bg-accent text-[#0A0B0D]"><ShieldCheck size={14} strokeWidth={2.4} /></div>
          <span className="font-semibold text-[14.5px] tracking-[-0.02em]">Painel</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTicketsView(!ticketsView)} className={cn("relative inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[9px] border text-[12px] font-medium transition-colors", ticketsView ? "border-accent/40 text-accent bg-accent-soft" : "border-border text-muted hover:text-text")}>
            <LifeBuoy size={13} /> Tickets
            {!ticketsView && ticketsUnread > 0 ? <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-bg" /> : null}
          </button>
          <button type="button" onClick={() => close(false)} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text transition-colors">
            <ArrowLeftRight size={13} /> App
          </button>
        </div>
      </div>
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-subtle">
        {ADMIN_NAV_ITEMS.map(({ id, key }) => {
          const on = !ticketsView && active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => { setTicketsView(false); toggleSection(id, on); }}
              className={cn(
                "shrink-0 h-8 px-3 rounded-[9px] text-[12.5px] font-medium transition-colors whitespace-nowrap",
                on ? "text-accent bg-card2" : "text-muted hover:text-text",
              )}
            >
              {LABEL[key]}
            </button>
          );
        })}
      </div>
    </header>
  );
}
