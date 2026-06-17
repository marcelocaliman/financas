import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Sun, Moon, Settings, Lock, LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { CurrencyMenu } from "./currency-toggle";
import { goToSection, scrollToSection } from "@/hooks/use-scroll-spy";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";
import { useRates } from "@/store/rates";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { convert, type Currency } from "@/money/currency";
import { Money } from "@/components/common/money";
import { Eyebrow } from "@/components/common/tile";
import { cn } from "@/lib/utils";

function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}

/** Glance do patrimônio: líquido + variação vs. o último registro. */
function useNetWorthGlance() {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const { data } = useDashboardData();
  return useMemo(() => {
    if (!data) return { net: 0, change: null as number | null, disp };
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const net = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0) - data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const trend = [...data.snapshots].sort((a, b) => a.month.localeCompare(b.month));
    const last = trend.at(-1);
    const prev = trend.at(-2);
    const change = last && prev && prev.amount !== 0 ? ((conv(last.amount, last.currency) - conv(prev.amount, prev.currency)) / Math.abs(conv(prev.amount, prev.currency))) * 100 : null;
    return { net, change, disp };
  }, [data, disp, rates]);
}

/**
 * Menu LATERAL flutuante (lg+): painel fixo à esquerda que acompanha a rolagem.
 * Reúne tudo do header (marca, navegação, moeda, privacidade, conta) + um relance do
 * patrimônio e o tema — aproveitando o espaço vertical. Alterna com o menu de topo na Config.
 */
export function SideNav({ active }: { active: string }) {
  const { t } = useTranslation();
  const numbersHidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);
  const glance = useNetWorthGlance();

  const name = nameFromEmail(email);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col fixed left-4 top-4 bottom-4 w-[244px] z-40 rounded-[20px] bg-card border border-border shadow-[var(--shadow-float)] overflow-hidden">
      <div className="flex flex-col h-full overflow-y-auto scrollbar-subtle">
        {/* Marca */}
        <button type="button" onClick={() => scrollToSection(NAV_ITEMS[0].id)} className="flex items-center gap-2.5 px-4 pt-4 pb-3.5 shrink-0">
          <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0A0B0D]">
            <ArrowLeftRight size={15} strokeWidth={2.6} />
          </div>
          <span className="font-semibold text-[15.5px] tracking-[-0.02em]">{t("app.name")}</span>
        </button>

        {/* Relance do patrimônio */}
        <div className="px-3.5 pb-3.5 shrink-0">
          <div className="rounded-[14px] bg-card2 border border-border px-3.5 py-3">
            <Eyebrow>{t("dashboard.netWorth")}</Eyebrow>
            <Money value={glance.net} currency={glance.disp} className="block font-semibold text-[19px] tracking-[-0.02em] tabular mt-1.5" />
            {glance.change != null ? (
              <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-medium mt-1 tabular", glance.change >= 0 ? "text-accent" : "text-neg")}>
                {glance.change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {(glance.change >= 0 ? "+" : "") + glance.change.toFixed(1)}%
                <span className="text-faint font-normal ml-0.5">{t("dashboard.vsMonth")}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex flex-col gap-0.5 px-2.5">
          {NAV_ITEMS.map(({ id, key, icon: Icon }) => {
            const on = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goToSection(id)}
                className={cn(
                  "flex items-center gap-3 h-10 px-3 rounded-[11px] text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                  on ? "text-accent bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
                )}
              >
                <Icon size={17} className="shrink-0" />
                <span className="truncate">{t(`nav.${key}`)}</span>
              </button>
            );
          })}
        </nav>

        {/* Rodapé: controles + conta */}
        <div className="mt-auto p-3 pt-3.5 border-t border-border">
          <div className="flex items-center gap-1.5 mb-2.5">
            <CurrencyMenu />
            <IconBtn onClick={toggleNumbers} label={numbersHidden ? t("menu.show") : t("menu.hide")} active={numbersHidden}>
              {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </IconBtn>
            <IconBtn onClick={toggleTheme} label={t("common.theme")}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </IconBtn>
            <div className="flex-1" />
            <IconBtn onClick={() => setConfigOpen(true)} label={t("menu.settings")}>
              <Settings size={16} />
            </IconBtn>
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
