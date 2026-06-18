import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Sun, Moon,
  Settings, Lock, LogOut, PanelLeftClose, PanelLeftOpen, CalendarClock,
  ChevronDown, ChevronsDownUp, ChevronsUpDown, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS, CONFIG_NAV_ITEMS } from "./nav-items";
import { CurrencyMenu } from "./currency-toggle";
import { goToSection, scrollToSection } from "@/hooks/use-scroll-spy";
import { useUI } from "@/store/ui";
import { useSections } from "@/store/sections";
import { useVault } from "@/vault/vault-store";
import { useAdminUI } from "@/store/admin-ui";
import { useIsAdmin } from "@/admin/use-admin";
import { useRates } from "@/store/rates";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { convert, type Currency } from "@/money/currency";
import { isInvestedClass, isQuotableClass } from "@/domain/taxonomy";
import { upcomingBills } from "@/domain/bills";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { Eyebrow } from "@/components/common/tile";
import { cn } from "@/lib/utils";

function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Relance: patrimônio líquido + variação, rentabilidade, saldo do mês e contas a vencer. */
function useGlance() {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const { data } = useDashboardData();
  return useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const net = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0) - data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);

    const trend = [...data.snapshots].sort((a, b) => a.month.localeCompare(b.month));
    const last = trend.at(-1);
    const prev = trend.at(-2);
    const change = last && prev && prev.amount !== 0 ? ((conv(last.amount, last.currency) - conv(prev.amount, prev.currency)) / Math.abs(conv(prev.amount, prev.currency))) * 100 : null;

    let totalCost = 0;
    let totalCostValue = 0;
    for (const a of data.assets.filter((x) => isInvestedClass(x.classId))) {
      const cost = isQuotableClass(a.classId) ? (a.quantity ?? 0) * (a.avgPrice ?? 0) : (a.cost ?? 0);
      if (cost > 0) { totalCost += conv(cost, a.currency); totalCostValue += conv(a.amount, a.currency); }
    }
    const returnPct = totalCost > 0 ? ((totalCostValue - totalCost) / totalCost) * 100 : null;

    const mo = currentMonth();
    const saldo = data.incomes.filter((i) => i.month === mo).reduce((s, i) => s + conv(i.amount, i.currency), 0) - data.expenses.filter((e) => e.month === mo).reduce((s, e) => s + conv(e.amount, e.currency), 0);

    const bills = upcomingBills(data.expenses, todayISO());
    const billTotal = bills.reduce((s, b) => s + conv(b.amount, b.currency), 0);

    return { net, change, returnPct, saldo, billCount: bills.length, billTotal, disp };
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
  const setAdminOpen = useAdminUI((s) => s.setAdminOpen);
  const isAdmin = useIsAdmin();
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);
  const openSections = useSections((s) => s.open);
  const setSectionOpen = useSections((s) => s.setOpen);
  const setManySections = useSections((s) => s.setMany);
  const g = useGlance();

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

        {/* Relance (só expandido) */}
        {!collapsed && g ? (
          <div className="px-3.5 pb-3.5 shrink-0 space-y-2.5">
            <div className="rounded-[14px] bg-card2 border border-border px-3.5 py-3">
              <Eyebrow>{t("dashboard.netWorth")}</Eyebrow>
              <Money value={g.net} currency={g.disp} className="block font-semibold text-[19px] tracking-[-0.02em] tabular mt-1.5" />
              {g.change != null ? (
                <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-medium mt-1 tabular", g.change >= 0 ? "text-accent" : "text-neg")}>
                  {g.change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  <Hidden>{(g.change >= 0 ? "+" : "") + g.change.toFixed(1) + "%"}</Hidden>
                  <span className="text-faint font-normal ml-0.5">{t("dashboard.vsMonth")}</span>
                </span>
              ) : null}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
                <div className="min-w-0">
                  <Eyebrow>{t("investimentos.profitability")}</Eyebrow>
                  <div className={cn("text-[13.5px] font-semibold tabular mt-1", g.returnPct == null ? "text-faint" : g.returnPct >= 0 ? "text-accent" : "text-neg")}>
                    {g.returnPct == null ? "—" : <Hidden>{`${g.returnPct >= 0 ? "+" : ""}${g.returnPct.toFixed(1)}%`}</Hidden>}
                  </div>
                </div>
                <div className="min-w-0">
                  <Eyebrow>{t("dashboard.monthlyBalance")}</Eyebrow>
                  <Money value={g.saldo} currency={g.disp} className={cn("block text-[13.5px] font-semibold tabular mt-1", g.saldo >= 0 ? "text-text" : "text-neg")} />
                </div>
              </div>
            </div>

            {g.billCount > 0 ? (
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
              <IconBtn onClick={toggleNumbers} label={numbersHidden ? t("menu.show") : t("menu.hide")} active={numbersHidden}>
                {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </IconBtn>
              <IconBtn onClick={toggleTheme} label={t("common.theme")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</IconBtn>
              <IconBtn onClick={() => setConfigOpen(!configOpen)} active={configOpen} label={t("menu.settings")}><Settings size={16} /></IconBtn>
              {isAdmin ? <IconBtn onClick={() => setAdminOpen(true)} label="Painel admin"><ShieldCheck size={16} /></IconBtn> : null}
              <div className="h-px w-7 bg-border my-0.5" />
              <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-[#0A0B0D] text-[12px] font-bold" title={email ?? ""}>{initial}</span>
              <IconBtn onClick={lock} label={t("menu.lock")}><Lock size={16} /></IconBtn>
              <IconBtn onClick={() => void signOut()} label={t("menu.logout")}><LogOut size={16} /></IconBtn>
            </>
          ) : (
            <>
              {/* Controles em ícone (já são claros): moeda, privacidade, tema */}
              <div className="flex items-center gap-1.5">
                <CurrencyMenu />
                <div className="flex-1" />
                <IconBtn onClick={toggleNumbers} label={numbersHidden ? t("menu.show") : t("menu.hide")} active={numbersHidden}>
                  {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </IconBtn>
                <IconBtn onClick={toggleTheme} label={t("common.theme")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</IconBtn>
              </div>

              {/* Itens de menu COM rótulo — separados da navegação de seções acima */}
              <div className="mt-2.5 pt-2.5 border-t border-border space-y-0.5">
                {isAdmin ? (
                  <FooterItem icon={ShieldCheck} label="Painel admin" onClick={() => setAdminOpen(true)} />
                ) : null}
                <FooterItem icon={Settings} label={t("menu.settings")} active={configOpen} onClick={() => setConfigOpen(!configOpen)} />
              </div>

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

interface NavListItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  isSection: boolean;
}

/** Lista de seções da nav lateral (página OU Config): rótulo + ícone, indicador de aberto e
 *  botão de abrir/fechar a seção. Mesmo visual nos dois modos. */
function NavList({
  items,
  collapsed,
  active,
  openSections,
  onNavigate,
  onToggle,
}: {
  items: NavListItem[];
  collapsed: boolean;
  active: string;
  openSections: Record<string, boolean>;
  onNavigate: (id: string) => void;
  onToggle: (id: string, v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav className={cn("flex flex-col gap-0.5", collapsed ? "px-2 items-center" : "px-2.5")}>
      {items.map(({ id, label, Icon, isSection }) => {
        const on = active === id;
        const sectionOpen = isSection && !!openSections[id];
        if (collapsed) {
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              title={label}
              aria-label={label}
              className={cn(
                "relative grid place-items-center w-11 h-11 rounded-[11px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                on ? "text-accent bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
              )}
            >
              <Icon size={17} />
              {sectionOpen ? <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" /> : null}
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
              onClick={() => onNavigate(id)}
              aria-label={label}
              className="flex items-center gap-3 h-10 px-3 flex-1 min-w-0 text-[13.5px] font-medium rounded-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Icon size={17} className="shrink-0" />
              <span className="truncate">{label}</span>
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

function IconBtn({ onClick, label, active, children }: { onClick: () => void; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center w-9 h-9 rounded-[10px] border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        active ? "border-border-strong bg-card2 text-text" : "border-border text-muted hover:text-text hover:bg-card-hover",
      )}
    >
      {children}
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
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
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
    </button>
  );
}

/** Topbar mínima só pra mobile quando o menu lateral está ativo (a sidebar é lg+). */
export function MobileBar() {
  const { t } = useTranslation();
  const numbersHidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
  const configOpen = useUI((s) => s.configOpen);
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
          <button type="button" onClick={() => setConfigOpen(!configOpen)} aria-label={t("menu.settings")} className={cn("grid place-items-center w-9 h-9 rounded-[10px] transition-colors", configOpen ? "text-accent bg-card-hover" : "text-muted hover:text-text hover:bg-card-hover")}>
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
