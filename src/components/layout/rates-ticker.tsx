import { useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useFxHistory } from "@/store/fx-history";
import { useMacro, MACRO_META } from "@/hooks/use-macro";
import { convert, formatMoney, formatPercent, CURRENCIES } from "@/money/currency";
import { pairChangePct } from "@/money/fx-daily";
import { currencyColors } from "@/money/composition";
import { cn } from "@/lib/utils";

/** Grupo de país: juros + inflação juntos, sob um selo de região só. */
interface MacroItem {
  key: string;
  kind: "macro";
  tag: string; // BR/EU/US/UK
  color: string;
  metrics: { label: string; value: string }[];
}
/** Câmbio de uma moeda contra a principal, com a variação do dia. */
interface FxItem {
  key: string;
  kind: "fx";
  label: string; // código da moeda
  value: string;
  pct: number | null;
  color: string;
}
type TickerItem = MacroItem | FxItem;

/**
 * Barra de cotações rolando no topo (marquee, pílula flutuante) — cada PAÍS com seu juro +
 * inflação lado a lado sob um selo de região (BR verde, resto cinza), seguido do câmbio das moedas
 * contra a principal com variação do dia. Só dado PÚBLICO de mercado (não esconde no modo privado).
 * Ligável em Configurações → Aparência.
 */
export function RatesTicker() {
  const theme = useUI((s) => s.theme);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const today = useFxHistory((s) => s.today);
  const prev = useFxHistory((s) => s.prev);
  const colors = currencyColors(theme);

  const brl = useMacro("BRL");
  const usd = useMacro("USD");
  const eur = useMacro("EUR");
  const gbp = useMacro("GBP");

  const items = useMemo<TickerItem[]>(() => {
    const macros = { BRL: brl, USD: usd, EUR: eur, GBP: gbp } as const;
    const out: TickerItem[] = [];
    // Um grupo por país: juros + inflação juntos (pula métricas sem dado; pula o país sem nenhuma).
    for (const c of CURRENCIES) {
      const m = macros[c];
      const metrics: { label: string; value: string }[] = [];
      if (m?.rate != null) metrics.push({ label: MACRO_META[c].rateName, value: formatPercent(m.rate, c) });
      if (m?.inflation != null) metrics.push({ label: MACRO_META[c].cpiName, value: formatPercent(m.inflation, c) });
      if (metrics.length) out.push({ key: `macro-${c}`, kind: "macro", tag: MACRO_META[c].tag, color: colors[c], metrics });
    }
    // Câmbio das outras moedas contra a principal.
    for (const c of CURRENCIES.filter((x) => x !== base)) {
      out.push({
        key: `fx-${c}`,
        kind: "fx",
        label: c,
        value: formatMoney(convert(1, c, base, rates), base, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        pct: today && prev ? pairChangePct(c, base, today, prev) : null,
        color: colors[c],
      });
    }
    return out;
  }, [brl, usd, eur, gbp, base, rates, today, prev, colors]);

  if (items.length === 0) return null;
  const duration = Math.max(24, items.length * 6); // rolagem ~constante independente do nº de itens

  return (
    <div className="hidden lg:block sticky top-4 z-30 mt-4">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14">
        <div className="ticker-viewport ticker-mask overflow-hidden rounded-full border border-border bg-card2/85 backdrop-blur-md shadow-[0_12px_22px_-16px_rgba(0,0,0,0.65)]">
          <div className="ticker-track flex w-max" style={{ ["--ticker-duration" as string]: `${duration}s` }}>
            <TickerRow items={items} />
            <TickerRow items={items} ariaHidden />
          </div>
        </div>
      </div>
    </div>
  );
}

function TickerRow({ items, ariaHidden }: { items: TickerItem[]; ariaHidden?: boolean }) {
  return (
    <div className="flex items-center shrink-0" aria-hidden={ariaHidden}>
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-2.5 px-4 py-2 whitespace-nowrap text-[12px]">
          {it.kind === "macro" ? (
            <>
              <span
                className="rounded-[5px] px-1.5 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] leading-none"
                style={{ color: it.color, background: `${it.color}22` }}
              >
                {it.tag}
              </span>
              {it.metrics.map((mt) => (
                <span key={mt.label} className="inline-flex items-center gap-1.5">
                  <span className="font-mono uppercase tracking-[0.08em] text-faint text-[10.5px]">{mt.label}</span>
                  <span className="tabular font-semibold text-text">{mt.value}</span>
                </span>
              ))}
            </>
          ) : (
            <>
              <span className="w-[6px] h-[6px] rounded-[2px] shrink-0" style={{ background: it.color }} />
              <span className="font-mono uppercase tracking-[0.08em] text-faint text-[10.5px]">{it.label}</span>
              <span className="tabular font-semibold text-text">{it.value}</span>
              {it.pct != null ? (
                <span className={cn("inline-flex items-center gap-0.5 tabular text-[11px]", it.pct >= 0 ? "text-accent" : "text-neg")}>
                  {it.pct >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {Math.abs(it.pct).toFixed(2)}%
                </span>
              ) : null}
            </>
          )}
          <span className="pl-1 text-faint/40">·</span>
        </span>
      ))}
    </div>
  );
}
