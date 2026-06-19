import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight, ArrowLeft, Eye, EyeOff, Sun, Moon,
  Settings, Lock, LogOut, PanelLeftClose, PanelLeftOpen, CalendarClock,
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, ShieldCheck, Landmark,
  MonitorSmartphone, Globe, LifeBuoy, type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS, CONFIG_NAV_ITEMS } from "./nav-items";
import { CurrencyMenu } from "./currency-toggle";
import { goToSection, scrollToSection } from "@/hooks/use-scroll-spy";
import { useUI } from "@/store/ui";
import { useSections } from "@/store/sections";
import { useVault } from "@/vault/vault-store";
import { useAdminUI } from "@/store/admin-ui";
import { useIsAdmin } from "@/admin/use-admin";
import { useOnlinePresence, useTicketsCounts } from "@/admin/use-realtime";
import { useMyTicketStats } from "@/hooks/use-my-ticket-stats";
import { useRates } from "@/store/rates";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useMacro, MACRO_META } from "@/hooks/use-macro";
import { convert, formatPercent, type Currency } from "@/money/currency";
import { upcomingBills } from "@/domain/bills";
import { Money } from "@/components/common/money";
import { Eyebrow } from "@/components/common/tile";
import { cn } from "@/lib/utils";

function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Relance do menu: só contas a vencer (alerta compacto). O patrimônio líquido saiu daqui —
 *  era redundante com o número-herói do Painel, logo acima. */
function useGlance() {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const { data } = useDashboardData();
  return useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const bills = upcomingBills(data.expenses, todayISO());
    const billTotal = bills.reduce((s, b) => s + conv(b.amount, b.currency), 0);
    return { billCount: bills.length, billTotal, disp };
  }, [data, disp, rates]);
}

/**
 * Menu LATERAL flutuante (lg+): painel à esquerda que acompanha a rolagem. Altura
 * automática (flutua), recolhível pra só ícones. Reúne tudo do header + um relance com
 * patrimônio/rentabilidade/saldo e alerta de vencimentos. Alterna com o topo na Config.
 */
export function SideNav({ active }: { active: string }) {
  const { t } = useTranslation();
  const collapsed = useUI((s) => s.navCollapsed);
  const setCollapsed = useUI((s) => s.setNavCollapsed);
  const numbersHidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
  const configOpen = useUI((s) => s.configOpen);
  const setSupportOpen = useUI((s) => s.setSupportOpen);
  const supportOpen = useUI((s) => s.supportOpen);
  const setAdminOpen = useAdminUI((s) => s.setAdminOpen);
  const { isAdmin } = useIsAdmin();
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);
  const openSections = useSections((s) => s.open);
  const setSectionOpen = useSections((s) => s.setOpen);
  const setManySections = useSections((s) => s.setMany);
  const g = useGlance();
  const disp = useUI((s) => s.displayCurrency);
  const macro = useMacro(disp);
  const macroMeta = MACRO_META[disp];
  const hasMacro = !!(macro && macroMeta && (macro.rate != null || macro.inflation != null));
  const hasBills = !!g && g.billCount > 0;
  const suporteUnread = useMyTicketStats().unread;

  // Seções da VISÃO ativa: na página, todas menos o Painel (que é hero); na Config, as 6 (todas
  // são accordions). É o que o "abrir/fechar todas" atua e o que a lista mostra.
  const sectionIds = configOpen
    ? CONFIG_NAV_ITEMS.map((c) => c.id)
    : NAV_ITEMS.slice(1).map((n) => n.id);
  const allOpen = sectionIds.length > 0 && sectionIds.every((id) => openSections[id]);

  // Itens normalizados das duas listas (página × Config) — renderizadas em cross-slide.
  const pageItems = NAV_ITEMS.map((n) => ({
    id: n.id, label: t(`nav.${n.key}`), Icon: n.icon, isSection: n.id !== NAV_ITEMS[0].id,
  }));
  const configItems = CONFIG_NAV_ITEMS.map((c) => ({
    id: c.id, label: t(c.labelKey), Icon: c.icon, isSection: true,
  }));
  // Navegar dentro da Config: abre o accordion e rola até ele (sem fechar a Config).
  const goConfig = (id: string) => {
    setSectionOpen(id, true);
    requestAnimationFrame(() => scrollToSection(id));
  };

  // Filmstrip do menu: as duas listas ficam lado a lado num trilho que desliza (só uma
  // visível por vez — sem ghosting). A altura do quadro acompanha a lista ativa (página tem
  // 8 itens, Config 6), animando junto pra o rodapé não "pular".
  const pageRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const [listH, setListH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = configOpen ? configRef.current : pageRef.current;
    if (el) setListH(el.offsetHeight);
  }, [configOpen, collapsed]);

  const name = nameFromEmail(email);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed left-4 top-4 z-40 rounded-[20px] bg-card border border-border shadow-[var(--shadow-float)] h-[calc(100vh-2rem)] overflow-hidden transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[244px]",
      )}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-subtle">
        {/* Marca + recolher */}
        <div className={cn("flex shrink-0 px-3 pt-4 pb-3", collapsed ? "flex-col items-center gap-2.5" : "items-center justify-between")}>
          <button type="button" onClick={() => goToSection(NAV_ITEMS[0].id)} className="flex items-center gap-2.5 min-w-0">
            <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
              <ArrowLeftRight size={15} strokeWidth={2.6} />
            </div>
            {!collapsed ? <span className="font-semibold text-[15.5px] tracking-[-0.02em] truncate">{t("app.name")}</span> : null}
          </button>
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

        {/* Relance (só expandido): contas a vencer + juros/inflação. (O patrimônio líquido saiu —
            redundante com o herói do Painel.) */}
        {!collapsed && (hasBills || hasMacro) ? (
          <div className="px-3.5 pb-3.5 shrink-0 space-y-2.5">
            {g && g.billCount > 0 ? (
              <button
                type="button"
                onClick={() => goToSection("orcamento")}
                className="w-full flex items-center gap-2.5 rounded-[12px] border border-border bg-[var(--neg-soft)] px-3 py-2.5 text-left hover:border-border-strong transition-colors"
              >
                <span className="grid place-items-center w-8 h-8 rounded-[10px] bg-card text-neg shrink-0">
                  <CalendarClock size={16} />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium leading-tight">{t("menu.billsDue", { n: g.billCount })}</div>
                  <Money value={g.billTotal} currency={g.disp} className="text-[11.5px] text-muted tabular" options={{ signDisplay: "never" }} />
                </div>
              </button>
            ) : null}

            {/* Juros + inflação do país da moeda (referência pública) — compacto, segue a moeda */}
            {macro && macroMeta && (macro.rate != null || macro.inflation != null) ? (
              <div className="rounded-[14px] bg-card2 border border-border px-3.5 py-3">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Landmark size={11} className="text-faint shrink-0" />
                  <Eyebrow>{t(`dashboard.${macroMeta.countryKey}`)}</Eyebrow>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="min-w-0">
                    <Eyebrow>{macroMeta.rateName}</Eyebrow>
                    <div className="text-[14.5px] font-semibold tabular mt-0.5 truncate">{macro.rate == null ? "—" : formatPercent(macro.rate, disp)}</div>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow>{t("dashboard.inflation")}</Eyebrow>
                    <div className="text-[14.5px] font-semibold tabular mt-0.5 truncate">{macro.inflation == null ? "—" : formatPercent(macro.inflation, disp)}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Cabeçalho das seções + abrir/fechar TODAS de uma vez */}
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

        {/* Navegação — filmstrip: as listas da PÁGINA e da CONFIG ficam lado a lado e o trilho
            desliza ao abrir/fechar a Config (só uma visível por vez). A altura do quadro segue a
            lista ativa, animando junto pra o rodapé não pular. */}
        <div
          className="relative overflow-hidden transition-[height] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ height: listH }}
        >
          <div
            className="flex items-start transition-transform duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none will-change-transform"
            style={{ transform: configOpen ? "translateX(-100%)" : "translateX(0%)" }}
          >
            <div ref={pageRef} inert={configOpen} className="w-full shrink-0">
              <NavList items={pageItems} collapsed={collapsed} active={active} openSections={openSections} onNavigate={goToSection} onToggle={setSectionOpen} />
            </div>
            <div ref={configRef} inert={!configOpen} className="w-full shrink-0">
              <NavList items={configItems} collapsed={collapsed} active={active} openSections={openSections} onNavigate={goConfig} onToggle={setSectionOpen} />
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé fixo no fim do menu — fora da área rolável */}
      <div className={cn("shrink-0 p-3 pt-3 border-t border-border", collapsed && "flex flex-col items-center gap-1.5")}>
          {collapsed ? (
            <>
              {configOpen ? (
                <IconBtn onClick={() => setConfigOpen(false)} label={t("menu.back")}><ArrowLeft size={16} /></IconBtn>
              ) : supportOpen ? (
                <IconBtn onClick={() => setSupportOpen(false)} label={t("menu.back")}><ArrowLeft size={16} /></IconBtn>
              ) : (
                <>
                  <IconBtn onClick={toggleNumbers} label={numbersHidden ? t("menu.show") : t("menu.hide")} active={numbersHidden}>
                    {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconBtn>
                  <IconBtn onClick={toggleTheme} label={t("common.theme")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</IconBtn>
                  <IconBtn onClick={() => setSupportOpen(true)} label={t("nav.suporte")} badge={suporteUnread}><LifeBuoy size={16} /></IconBtn>
                  <IconBtn onClick={() => setConfigOpen(!configOpen)} active={configOpen} label={t("menu.settings")}><Settings size={16} /></IconBtn>
                  {isAdmin ? <AdminRailCollapsed onOpen={() => setAdminOpen(true)} /> : null}
                </>
              )}
              <div className="h-px w-7 bg-border my-0.5" />
              <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-[#0A0B0D] text-[12px] font-bold" title={email ?? ""}>{initial}</span>
              <IconBtn onClick={lock} label={t("menu.lock")}><Lock size={16} /></IconBtn>
              <IconBtn onClick={() => void signOut()} label={t("menu.logout")}><LogOut size={16} /></IconBtn>
            </>
          ) : (
            <>
              {configOpen ? (
                /* Em Configurações: só "Voltar ao app" (como no painel admin) */
                <FooterItem icon={ArrowLeft} label={t("menu.back")} onClick={() => setConfigOpen(false)} />
              ) : supportOpen ? (
                /* Em Ajuda & Suporte: mesma cara — só "Voltar ao app" */
                <FooterItem icon={ArrowLeft} label={t("menu.back")} onClick={() => setSupportOpen(false)} />
              ) : (
                <>
                  {/* Controles em ícone (já são claros): moeda, privacidade, tema */}
                  <div className="flex items-center gap-1.5">
                    <CurrencyMenu dropUp alignLeft />
                    <div className="flex-1" />
                    <IconBtn onClick={toggleNumbers} label={numbersHidden ? t("menu.show") : t("menu.hide")} active={numbersHidden}>
                      {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconBtn>
                    <IconBtn onClick={toggleTheme} label={t("common.theme")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</IconBtn>
                  </div>

                  {/* Itens de menu COM rótulo — separados da navegação de seções acima */}
                  <div className="mt-2.5 pt-2.5 border-t border-border space-y-1">
                    {isAdmin ? <AdminPresence collapsed={false} onOpenAdmin={() => setAdminOpen(true)} /> : null}
                    <FooterItem icon={LifeBuoy} label={t("nav.suporte")} badge={suporteUnread} onClick={() => setSupportOpen(true)} />
                    <FooterItem icon={Settings} label={t("menu.settings")} active={configOpen} onClick={() => setConfigOpen(!configOpen)} />
                  </div>
                </>
              )}

              {/* Conta — nome e e-mail ganham a linha inteira; travar/sair embaixo */}
              <div className="mt-2.5 pt-3 border-t border-border">
                <div className="flex items-center gap-2.5 px-1">
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-[#0A0B0D] text-[13px] font-bold shrink-0">{initial}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate leading-tight">{name || t("menu.account")}</div>
                    {email ? <div className="text-[11px] text-faint truncate mt-0.5">{email}</div> : null}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={lock}
                    className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Lock size={14} className="shrink-0" /> {t("menu.lock")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-neg hover:bg-card-hover transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <LogOut size={14} className="shrink-0" /> {t("menu.logout")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
    </aside>
  );
}

export interface NavListItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  isSection: boolean;
}

/** Lista de seções da nav lateral (página OU Config): rótulo + ícone, indicador de aberto e
 *  botão de abrir/fechar a seção. Mesmo visual nos dois modos. Reusada pelo painel admin. */
export function NavList({
  items,
  collapsed,
  active,
  openSections,
  onNavigate,
  onToggle,
  badges,
}: {
  items: NavListItem[];
  collapsed: boolean;
  active: string;
  openSections: Record<string, boolean>;
  onNavigate: (id: string) => void;
  onToggle: (id: string, v: boolean) => void;
  /** Selo de notificação por item (ex.: tickets de suporte não lidos). */
  badges?: Record<string, number>;
}) {
  const { t } = useTranslation();
  return (
    <nav className={cn("flex flex-col gap-0.5", collapsed ? "px-2 items-center" : "px-2.5")}>
      {items.map(({ id, label, Icon, isSection }) => {
        const on = active === id;
        const sectionOpen = isSection && !!openSections[id];
        const badge = badges?.[id] ?? 0;
        // Clique no item ALTERNA: se já estamos na seção e ela está aberta, fecha; senão
        // navega (abre + rola). Dá pra abrir E fechar a aba pelo próprio menu.
        const handleClick = () => (sectionOpen && on ? onToggle(id, false) : onNavigate(id));
        if (collapsed) {
          return (
            <button
              key={id}
              type="button"
              onClick={handleClick}
              title={label}
              aria-label={label}
              className={cn(
                "relative grid place-items-center w-11 h-11 rounded-[11px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                on ? "text-accent bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
              )}
            >
              <Icon size={17} />
              {badge > 0 ? (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-card" />
              ) : sectionOpen ? (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
              ) : null}
            </button>
          );
        }
        return (
          <div
            key={id}
            className={cn(
              "flex items-center rounded-[11px] transition-colors",
              on ? "text-accent bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
            )}
          >
            <button
              type="button"
              onClick={handleClick}
              aria-label={label}
              className="flex items-center gap-3 h-10 px-3 flex-1 min-w-0 text-[13.5px] font-medium rounded-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Icon size={17} className="shrink-0" />
              <span className="truncate">{label}</span>
              {badge > 0 ? (
                <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-accent text-[#0A0B0D] text-[10px] font-bold tabular leading-none">
                  {badge}
                </span>
              ) : null}
            </button>
            {isSection ? (
              <button
                type="button"
                onClick={() => onToggle(id, !sectionOpen)}
                aria-label={sectionOpen ? t("menu.collapse") : t("menu.expand")}
                title={sectionOpen ? t("menu.collapse") : t("menu.expand")}
                aria-expanded={sectionOpen}
                className="grid place-items-center w-8 h-10 shrink-0 rounded-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <ChevronDown size={15} className={cn("transition-transform duration-200", sectionOpen ? "text-accent" : "-rotate-90 text-faint")} />
              </button>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function IconBtn({ onClick, label, active, badge = 0, children }: { onClick: () => void; label: string; active?: boolean; badge?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge > 0 ? `${label} (${badge})` : label}
      title={label}
      className={cn(
        "relative grid place-items-center w-9 h-9 rounded-[10px] border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        active ? "border-border-strong bg-card2 text-text" : "border-border text-muted hover:text-text hover:bg-card-hover",
      )}
    >
      {children}
      {badge > 0 ? <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-card" /> : null}
    </button>
  );
}

/** Item de menu do rodapé COM rótulo (Painel admin / Configurações) — mesmo visual dos
 *  itens de seção, mas separado da navegação principal. */
function FooterItem({
  icon: Icon,
  label,
  onClick,
  active,
  badge = 0,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full flex items-center gap-3 h-10 px-3 rounded-[11px] text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        active ? "text-accent bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
      )}
    >
      <Icon size={17} className="shrink-0" />
      <span className="truncate">{label}</span>
      {badge > 0 ? (
        <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-accent text-[#0A0B0D] text-[10px] font-bold tabular leading-none">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Pontinho "ao vivo" (ping verde) — sinaliza dado em tempo real. */
function LiveDot({ size = "h-2 w-2" }: { size?: string }) {
  return (
    <span className={cn("relative flex shrink-0", size)}>
      <span className={cn("animate-ping motion-reduce:animate-none absolute inline-flex rounded-full bg-accent opacity-60", size)} />
      <span className={cn("relative inline-flex rounded-full bg-accent", size)} />
    </span>
  );
}

/**
 * Mini-card "online agora" — SÓ pro super-admin (renderizado dentro do guard isAdmin, então o
 * hook só monta pra admin). Mostra logados no app + visitantes na landing em tempo real, pra dar
 * a visão rápida sem abrir o painel. Os números são metadado agregado (não dado financeiro do
 * usuário) — não passam por privacidade. A segurança real é a RLS is_admin no RPC/Realtime.
 * O hook é singleton ref-contado: compartilha o canal com o painel se ele estiver aberto.
 */
/** Rail recolhido (admin): botão do painel com selo de não-lidos + mini-card "online agora". */
function AdminRailCollapsed({ onOpen }: { onOpen: () => void }) {
  const unread = useTicketsCounts().unread;
  return (
    <>
      <IconBtn onClick={onOpen} label="Painel admin" badge={unread}><ShieldCheck size={16} /></IconBtn>
      <AdminPresence collapsed />
    </>
  );
}

function AdminPresence({ collapsed, onOpenAdmin }: { collapsed: boolean; onOpenAdmin?: () => void }) {
  const p = useOnlinePresence();
  const unread = useTicketsCounts().unread;

  if (collapsed) {
    return (
      <div
        role="img"
        aria-label={`Online agora — ${p.app} no app, ${p.landing} na landing`}
        title={`Online agora — app ${p.app} · landing ${p.landing}`}
        className="flex flex-col items-center gap-1 w-11 py-1.5 rounded-[11px] border border-border bg-card2"
      >
        <LiveDot size="h-1.5 w-1.5" />
        <span aria-hidden className="text-[12px] font-semibold tabular text-accent leading-none">{p.app}</span>
        <span aria-hidden className="text-[10px] tabular text-faint leading-none">{p.landing}</span>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-border bg-card2 overflow-hidden">
      {onOpenAdmin ? (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ShieldCheck size={16} className="shrink-0" />
          <span className="text-[13px] font-medium flex-1 truncate">Painel admin</span>
          {unread > 0 ? (
            <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[#0A0B0D] text-[11px] font-bold tabular shrink-0">{unread}</span>
          ) : null}
          <ChevronRight size={14} className="text-faint shrink-0" />
        </button>
      ) : null}
      <div className={cn("px-3 py-2.5", onOpenAdmin && "border-t border-border")}>
        <div className="flex items-center gap-1.5 mb-2">
          <LiveDot />
          <Eyebrow>Online agora</Eyebrow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-faint">
              <MonitorSmartphone size={11} className="shrink-0" />
              <Eyebrow>App</Eyebrow>
            </div>
            <div className="text-[17px] font-semibold tabular text-accent mt-0.5 leading-none">{p.app}</div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-faint">
              <Globe size={11} className="shrink-0" />
              <Eyebrow>Landing</Eyebrow>
            </div>
            <div className="text-[17px] font-semibold tabular text-text mt-0.5 leading-none">{p.landing}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Topbar mínima só pra mobile quando o menu lateral está ativo (a sidebar é lg+). */
export function MobileBar() {
  const { t } = useTranslation();
  const numbersHidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
  const configOpen = useUI((s) => s.configOpen);
  const setSupportOpen = useUI((s) => s.setSupportOpen);
  const supportOpen = useUI((s) => s.supportOpen);
  const supportUnread = useMyTicketStats().unread;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={cn("lg:hidden fixed top-0 left-0 right-0 z-50 transition-colors duration-300", scrolled ? "glass border-b border-border" : "border-b border-transparent")}>
      <div className="flex items-center justify-between gap-3 h-[60px] px-5">
        <button type="button" onClick={() => goToSection(NAV_ITEMS[0].id)} className="flex items-center gap-2.5">
          <div className="grid place-items-center w-[28px] h-[28px] rounded-[8px] bg-accent text-[#0A0B0D]"><ArrowLeftRight size={14} strokeWidth={2.6} /></div>
          <span className="font-semibold text-[15px] tracking-[-0.02em]">{t("app.name")}</span>
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleNumbers} aria-label={numbersHidden ? t("menu.show") : t("menu.hide")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors">
            {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <CurrencyMenu />
          <button type="button" onClick={() => setSupportOpen(!supportOpen)} aria-label={t("nav.suporte")} className={cn("relative grid place-items-center w-9 h-9 rounded-[10px] transition-colors", supportOpen ? "text-accent bg-card-hover" : "text-muted hover:text-text hover:bg-card-hover")}>
            {supportOpen ? <ArrowLeft size={16} /> : <LifeBuoy size={16} />}
            {!supportOpen && supportUnread > 0 ? <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-bg" /> : null}
          </button>
          <button type="button" onClick={() => setConfigOpen(!configOpen)} aria-label={configOpen ? t("menu.back") : t("menu.settings")} className={cn("grid place-items-center w-9 h-9 rounded-[10px] transition-colors", configOpen ? "text-accent bg-card-hover" : "text-muted hover:text-text hover:bg-card-hover")}>
            {configOpen ? <ArrowLeft size={16} /> : <Settings size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
