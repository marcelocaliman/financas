import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Sun, Moon,
  Settings, Lock, LogOut, PanelLeftClose, PanelLeftOpen, CalendarClock,
  ChevronDown, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { CurrencyMenu } from "./currency-toggle";
import { goToSection, scrollToSection } from "@/hooks/use-scroll-spy";
import { useUI } from "@/store/ui";
import { useSections } from "@/store/sections";
import { useVault } from "@/vault/vault-store";
import { useRates } from "@/store/rates";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { convert, type Currency } from "@/money/currency";
import { isInvestedClass, isQuotableClass } from "@/domain/taxonomy";
import { upcomingBills } from "@/domain/bills";
import { Money } from "@/components/common/money";
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
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);
  const openSections = useSections((s) => s.open);
  const setSectionOpen = useSections((s) => s.setOpen);
  const setManySections = useSections((s) => s.setMany);
  const g = useGlance();

  // Seções = todos os itens menos o Painel (que é o hero, não um accordion).
  const sectionIds = NAV_ITEMS.slice(1).map((n) => n.id);
  const allOpen = sectionIds.every((id) => openSections[id]);
  const name = nameFromEmail(email);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed left-4 top-4 z-40 rounded-[20px] bg-card border border-border shadow-[var(--shadow-float)] max-h-[calc(100vh-2rem)] overflow-hidden transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[244px]",
      )}
    >
      <div className="flex flex-col overflow-y-auto scrollbar-subtle">
        {/* Marca + recolher */}
        <div className={cn("flex shrink-0 px-3 pt-4 pb-3", collapsed ? "flex-col items-center gap-2.5" : "items-center justify-between")}>
          <button type="button" onClick={() => scrollToSection(NAV_ITEMS[0].id)} className="flex items-center gap-2.5 min-w-0">
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
                  {(g.change >= 0 ? "+" : "") + g.change.toFixed(1)}%
                  <span className="text-faint font-normal ml-0.5">{t("dashboard.vsMonth")}</span>
                </span>
              ) : null}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
                <div className="min-w-0">
                  <Eyebrow>{t("investimentos.profitability")}</Eyebrow>
                  <div className={cn("text-[13.5px] font-semibold tabular mt-1", g.returnPct == null ? "text-faint" : g.returnPct >= 0 ? "text-accent" : "text-neg")}>
                    {g.returnPct == null ? "—" : `${g.returnPct >= 0 ? "+" : ""}${g.returnPct.toFixed(1)}%`}
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

        {/* Navegação */}
        <nav className={cn("flex flex-col gap-0.5", collapsed ? "px-2 items-center" : "px-2.5")}>
          {NAV_ITEMS.map(({ id, key, icon: Icon }) => {
            const on = active === id;
            const isSection = id !== NAV_ITEMS[0].id; // o Painel não é accordion
            const sectionOpen = isSection && !!openSections[id];
            if (collapsed) {
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => goToSection(id)}
                  title={t(`nav.${key}`)}
                  aria-label={t(`nav.${key}`)}
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
                  onClick={() => goToSection(id)}
                  aria-label={t(`nav.${key}`)}
                  className="flex items-center gap-3 h-10 px-3 flex-1 min-w-0 text-[13.5px] font-medium rounded-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <Icon size={17} className="shrink-0" />
                  <span className="truncate">{t(`nav.${key}`)}</span>
                </button>
                {isSection ? (
                  <button
                    type="button"
                    onClick={() => setSectionOpen(id, !sectionOpen)}
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

        {/* Rodapé */}
        <div className={cn("p-3 pt-3.5 mt-1 border-t border-border", collapsed && "flex flex-col items-center gap-1.5")}>
          {collapsed ? (
            <>
              <IconBtn onClick={toggleNumbers} label={numbersHidden ? t("menu.show") : t("menu.hide")} active={numbersHidden}>
                {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </IconBtn>
              <IconBtn onClick={toggleTheme} label={t("common.theme")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</IconBtn>
              <IconBtn onClick={() => setConfigOpen(true)} label={t("menu.settings")}><Settings size={16} /></IconBtn>
              <div className="h-px w-7 bg-border my-0.5" />
              <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-[#0A0B0D] text-[12px] font-bold" title={email ?? ""}>{initial}</span>
              <IconBtn onClick={() => void signOut()} label={t("menu.logout")}><LogOut size={16} /></IconBtn>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mb-2.5">
                <CurrencyMenu />
                <IconBtn onClick={toggleNumbers} label={numbersHidden ? t("menu.show") : t("menu.hide")} active={numbersHidden}>
                  {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </IconBtn>
                <IconBtn onClick={toggleTheme} label={t("common.theme")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</IconBtn>
                <div className="flex-1" />
                <IconBtn onClick={() => setConfigOpen(true)} label={t("menu.settings")}><Settings size={16} /></IconBtn>
              </div>
              <div className="flex items-center gap-2.5 px-1 py-1.5">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-accent text-[#0A0B0D] text-[12px] font-bold shrink-0">{initial}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold truncate leading-tight">{name || t("menu.account")}</div>
                  {email ? <div className="text-[11px] text-faint truncate">{email}</div> : null}
                </div>
                <button type="button" onClick={lock} aria-label={t("menu.lock")} title={t("menu.lock")} className="grid place-items-center w-8 h-8 rounded-[9px] text-muted hover:text-text hover:bg-card-hover transition-colors shrink-0">
                  <Lock size={15} />
                </button>
                <button type="button" onClick={() => void signOut()} aria-label={t("menu.logout")} title={t("menu.logout")} className="grid place-items-center w-8 h-8 rounded-[9px] text-muted hover:text-neg hover:bg-card-hover transition-colors shrink-0">
                  <LogOut size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
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

/** Topbar mínima só pra mobile quando o menu lateral está ativo (a sidebar é lg+). */
export function MobileBar() {
  const { t } = useTranslation();
  const numbersHidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
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
        <button type="button" onClick={() => scrollToSection(NAV_ITEMS[0].id)} className="flex items-center gap-2.5">
          <div className="grid place-items-center w-[28px] h-[28px] rounded-[8px] bg-accent text-[#0A0B0D]"><ArrowLeftRight size={14} strokeWidth={2.6} /></div>
          <span className="font-semibold text-[15px] tracking-[-0.02em]">{t("app.name")}</span>
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleNumbers} aria-label={numbersHidden ? t("menu.show") : t("menu.hide")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors">
            {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <CurrencyMenu />
          <button type="button" onClick={() => setConfigOpen(true)} aria-label={t("menu.settings")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
