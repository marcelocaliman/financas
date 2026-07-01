import { useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useFxHistory } from "@/store/fx-history";
import { useMacro, MACRO_META } from "@/hooks/use-macro";
import { convert, formatMoney, formatPercent, CURRENCIES, type Currency } from "@/money/currency";
import { pairChangePct } from "@/money/fx-daily";
import { currencyColors } from "@/money/composition";
import { cn } from "@/lib/utils";

interface TickerItem {
  key: string;
  label: string;
  value: string;
  pct?: number | null;
  color?: string;
}

/**
 * Barra de cotações rolando no topo do conteúdo (marquee) — juros dos principais BCs + inflação
 * local + câmbio das moedas contra a principal, com variação do dia. Dá o "ar de app financeiro"
 * e libera os cards do menu. Só dado PÚBLICO de mercado (não esconde no modo privado). Ligável em
 * Configurações → Aparência (interruptor reversível).
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
    const macros: Record<Currency, ReturnType<typeof useMacro>> = { BRL: brl, USD: usd, EUR: eur, GBP: gbp };
    const out: TickerItem[] = [];
    // Juros de política dos principais bancos centrais (pula os sem dado).
    for (const c of CURRENCIES) {
      const m = macros[c];
      if (m?.rate != null) out.push({ key: `rate-${c}`, label: MACRO_META[c].rateName, value: formatPercent(m.rate, c) });
    }
    // Inflação da moeda principal.
    const local = macros[base];
    if (local?.inflation != null) out.push({ key: "cpi", label: MACRO_META[base].cpiName, value: formatPercent(local.inflation, base) });
    // Câmbio das outras moedas contra a principal, com a variação do dia.
    for (const c of CURRENCIES.filter((x) => x !== base)) {
      out.push({
        key: `fx-${c}`,
        label: c,
        value: formatMoney(convert(1, c, base, rates), base, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        pct: today && prev ? pairChangePct(c, base, today, prev) : null,
        color: colors[c],
      });
    }
    return out;
  }, [brl, usd, eur, gbp, base, rates, today, prev, colors]);

  if (items.length === 0) return null;
  const duration = Math.max(20, items.length * 4); // rolagem ~constante independente do nº de itens

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
      {items.map((it) => {
        const up = (it.pct ?? 0) >= 0;
        return (
          <span key={it.key} className="inline-flex items-center gap-2 px-5 py-2 whitespace-nowrap text-[12px]">
            {it.color ? <span className="w-[6px] h-[6px] rounded-[2px] shrink-0" style={{ background: it.color }} /> : null}
            <span className="font-mono uppercase tracking-[0.08em] text-faint text-[10.5px]">{it.label}</span>
            <span className="tabular font-semibold text-text">{it.value}</span>
            {it.pct != null ? (
              <span className={cn("inline-flex items-center gap-0.5 tabular text-[11px]", up ? "text-accent" : "text-neg")}>
                {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {Math.abs(it.pct).toFixed(2)}%
              </span>
            ) : null}
            <span className="px-1 text-faint/40">·</span>
          </span>
        );
      })}
    </div>
  );
}
