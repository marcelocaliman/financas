import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useFxHistory } from "@/store/fx-history";
import { useSpot } from "@/store/spot";
import { useMacro, MACRO_META } from "@/hooks/use-macro";
import { convert, formatMoney, formatPercent, CURRENCIES } from "@/money/currency";
import { pairChangePct } from "@/money/fx-daily";
import { SPOT_ASSETS, ASSET_META, QUOTE, assetColor } from "@/money/spot";
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
/** Câmbio de uma moeda contra a principal, com a variação do dia. Selo = código da moeda. */
interface FxItem {
  key: string;
  kind: "fx";
  tag: string; // EUR/USD/GBP
  value: string;
  pct: number | null;
  color: string;
}
/** Ouro (XAU/oz) ou bitcoin na moeda principal, com a variação do dia. Renderiza igual ao câmbio. */
interface AssetItem {
  key: string;
  kind: "asset";
  tag: string; // OURO / BTC
  value: string;
  unit: string | null; // ex.: "oz" pro ouro
  pct: number | null;
  color: string;
}
/** Barra separando as seções (juros/inflação · câmbio · ativos). */
interface DividerItem {
  key: string;
  kind: "divider";
}
type TickerItem = MacroItem | FxItem | AssetItem | DividerItem;

/**
 * Barra de cotações rolando no topo (marquee, pílula flutuante). Todos os itens padronizados por
 * SELO colorido: juros+inflação de cada país sob o selo da região (BR verde, resto cinza), depois
 * uma BARRA, depois o câmbio das moedas (selo = código) com variação do dia. Só dado PÚBLICO de
 * mercado (não esconde no modo privado). Ligável em Configurações → Aparência.
 */
export function RatesTicker() {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const today = useFxHistory((s) => s.today);
  const prev = useFxHistory((s) => s.prev);
  const colors = currencyColors(theme);

  const spotPrices = useSpot((s) => s.prices);
  const spotPrev = useSpot((s) => s.prevPrices);
  const refreshSpot = useSpot((s) => s.refresh);

  // Ouro/bitcoin só são buscados quando o ticker está montado (é opt-in) — nada de request à toa.
  // Cotados em USD fixo, então não dependem da moeda do usuário: refaz no mount + foco/rede.
  useEffect(() => {
    refreshSpot();
    const onWake = () => {
      if (document.visibilityState === "visible") refreshSpot();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [refreshSpot]);

  const brl = useMacro("BRL");
  const usd = useMacro("USD");
  const eur = useMacro("EUR");
  const gbp = useMacro("GBP");

  const items = useMemo<TickerItem[]>(() => {
    const macros = { BRL: brl, USD: usd, EUR: eur, GBP: gbp } as const;
    // Um grupo por país: juros + inflação juntos (pula métricas sem dado; pula o país sem nenhuma).
    const macroItems: MacroItem[] = [];
    for (const c of CURRENCIES) {
      const m = macros[c];
      const metrics: { label: string; value: string }[] = [];
      if (m?.rate != null) metrics.push({ label: MACRO_META[c].rateName, value: formatPercent(m.rate, c) });
      if (m?.inflation != null) metrics.push({ label: MACRO_META[c].cpiName, value: formatPercent(m.inflation, c) });
      if (metrics.length) macroItems.push({ key: `macro-${c}`, kind: "macro", tag: MACRO_META[c].tag, color: colors[c], metrics });
    }
    // Câmbio das outras moedas contra a principal.
    const fxItems: FxItem[] = CURRENCIES.filter((x) => x !== base).map((c) => ({
      key: `fx-${c}`,
      kind: "fx",
      tag: c,
      value: formatMoney(convert(1, c, base, rates), base, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
      pct: today && prev ? pairChangePct(c, base, today, prev) : null,
      color: colors[c],
    }));
    // Ouro + bitcoin, sempre em DÓLAR (QUOTE) — a convenção desses mercados, independente da moeda
    // principal do usuário. O selo já diz OURO/BTC; o "$" deixa claro que é dólar.
    const assetItems: AssetItem[] = SPOT_ASSETS.filter((a) => spotPrices[a] != null).map((a) => {
      const price = spotPrices[a]!;
      const p = spotPrev[a];
      return {
        key: `spot-${a}`,
        kind: "asset",
        tag: a === "XAU" ? t("dashboard.gold") : "BTC",
        value: formatMoney(price, QUOTE, { maximumFractionDigits: 0 }),
        unit: ASSET_META[a].unit ?? null,
        pct: p != null && p > 0 ? ((price - p) / p) * 100 : null,
        color: assetColor(a, theme),
      };
    });
    // Junta as seções não vazias com uma barra entre cada (e uma no começo, p/ o loop separar
    // a virada do marquee). Ex.: | juros/inflação | câmbio | ouro/bitcoin |.
    const sections = [macroItems, fxItems, assetItems].filter((s) => s.length > 0);
    const out: TickerItem[] = [];
    sections.forEach((sec, i) => {
      if (i === 0 && sections.length > 1) out.push({ key: "d-start", kind: "divider" });
      out.push(...sec);
      if (i < sections.length - 1) out.push({ key: `d-${i}`, kind: "divider" });
    });
    return out;
  }, [brl, usd, eur, gbp, base, rates, today, prev, colors, spotPrices, spotPrev, theme, t]);

  const content = items.filter((i) => i.kind !== "divider").length;
  if (content === 0) return null;
  const duration = Math.max(28, content * 7); // rolagem ~constante independente do nº de itens

  return (
    <div className="hidden lg:flex sticky top-0 z-30 h-[62px] -mb-[62px] items-center">
      <div className="w-full max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14">
        <div className="ticker-viewport ticker-mask overflow-hidden rounded-full border border-border bg-[color-mix(in_oklab,var(--card-2)_70%,transparent)] backdrop-blur-xl shadow-[0_6px_24px_-20px_rgba(0,0,0,0.35)]">
          <div className="ticker-track flex w-max" style={{ ["--ticker-duration" as string]: `${duration}s` }}>
            <TickerRow items={items} />
            <TickerRow items={items} ariaHidden />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Selo colorido com o código da região/moeda — padrão comum a juros e câmbio. */
function Chip({ tag, color }: { tag: string; color: string }) {
  return (
    <span
      className="rounded-[5px] px-1.5 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] leading-none shrink-0"
      style={{ color, background: `${color}22` }}
    >
      {tag}
    </span>
  );
}

function TickerRow({ items, ariaHidden }: { items: TickerItem[]; ariaHidden?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center shrink-0" aria-hidden={ariaHidden}>
      {items.map((it) => {
        if (it.kind === "divider") return <span key={it.key} className="mx-2 h-5 w-px shrink-0 bg-[var(--border-strong)]" />;
        return (
          <span key={it.key} className="inline-flex items-center gap-2.5 px-4 py-2 whitespace-nowrap text-[12px]">
            <Chip tag={it.tag} color={it.color} />
            {it.kind === "macro" ? (
              it.metrics.map((mt) => (
                <span key={mt.label} className="inline-flex items-center gap-1.5">
                  <span className="font-mono uppercase tracking-[0.08em] text-faint text-[10.5px]">{mt.label}</span>
                  <span className="tabular font-semibold text-text">{mt.value}</span>
                </span>
              ))
            ) : (
              <>
                <span className="tabular font-semibold text-text">{it.value}</span>
                {it.kind === "asset" && it.unit ? (
                  <span title={t("dashboard.perTroyOunce")} className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                    /{it.unit}
                  </span>
                ) : null}
                {it.pct != null ? (
                  <span className={cn("inline-flex items-center gap-0.5 tabular text-[11px]", it.pct >= 0 ? "text-accent" : "text-neg")}>
                    {it.pct >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {Math.abs(it.pct).toFixed(2)}%
                  </span>
                ) : null}
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}
