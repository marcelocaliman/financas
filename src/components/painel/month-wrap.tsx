import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { useUI } from "@/store/ui";
import { useMonthWrap, type MonthWrap as Wrap } from "@/hooks/use-month-wrap";
import { useEngagement } from "@/store/engagement";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { cn } from "@/lib/utils";

const LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

function monthName(ymStr: string, lang: string): string {
  const [y, m] = ymStr.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString(LOCALE[lang] ?? "pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "Fechamento do mês" — resumo do mês que acabou (variação do patrimônio, poupança, maior gasto).
 * Ritual recorrente: aparece 1× quando o usuário abre num mês NOVO (e o mês anterior teve dados).
 * Dispensável. Container: dados + gatilho; View pura. Números respeitam privacidade.
 */
export function MonthWrap() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const wrap = useMonthWrap();
  const lastWrappedMonth = useEngagement((s) => s.lastWrappedMonth);
  const setWrapped = useEngagement((s) => s.setWrapped);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !wrap) return; // espera os dados
    ranRef.current = true;
    if (wrap.currentMonth !== lastWrappedMonth && wrap.hasData) {
      setShow(true);
      setWrapped(wrap.currentMonth); // marca já — mostra 1× por mês (mesmo sem dispensar)
    }
  }, [wrap, lastWrappedMonth, setWrapped]);

  if (!show || dismissed || !wrap) return null;
  return (
    <div className="mb-7">
      <MonthWrapView title={monthName(wrap.month, lang)} wrap={wrap} onDismiss={() => setDismissed(true)} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="text-[17px] font-semibold tracking-[-0.02em] tabular leading-tight mt-1 truncate">{value}</div>
      {sub ? <div className="text-[11.5px] text-muted mt-0.5 truncate">{sub}</div> : null}
    </div>
  );
}

/** Parte visual pura — card "Wrapped" do mês. */
export function MonthWrapView({ title, wrap, onDismiss }: { title: string; wrap: Wrap; onDismiss: () => void }) {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const up = (wrap.nwChangePct ?? 0) >= 0;
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-border bg-gradient-to-br from-[var(--card-2)] to-card p-5">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">{t("wrap.eyebrow")}</div>
          <div className="text-[19px] font-semibold tracking-[-0.025em] leading-tight mt-0.5 truncate">{title}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("welcome.dismiss")}
          className="shrink-0 grid place-items-center w-7 h-7 rounded-[8px] text-faint hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        {wrap.nwChangePct != null ? (
          <Stat
            label={t("wrap.netWorth")}
            value={
              <span className={cn("inline-flex items-center gap-1", up ? "text-accent" : "text-neg")}>
                {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                <Hidden>{(up ? "+" : "") + wrap.nwChangePct.toFixed(1) + "%"}</Hidden>
              </span>
            }
            sub={wrap.nwChangeAbs != null ? <Money value={wrap.nwChangeAbs} currency={disp} /> : undefined}
          />
        ) : null}
        <Stat
          label={t("wrap.saved")}
          value={<Money value={wrap.saved} currency={disp} className={cn(wrap.saved >= 0 ? "text-text" : "text-neg")} />}
          sub={<Hidden>{`${Math.round(wrap.savingsRate)}% ${t("wrap.savingsRate")}`}</Hidden>}
        />
        {wrap.topCategory ? (
          <Stat
            label={t("wrap.topSpend")}
            value={<span className="text-text">{wrap.topCategory.name}</span>}
            sub={<Money value={wrap.topCategory.value} currency={disp} options={{ signDisplay: "never" }} />}
          />
        ) : null}
      </div>
    </div>
  );
}
