import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
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

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0 });

  // Ouro/bitcoin só são buscados quando o ticker está montado (é opt-in) — nada de request à toa.
  // Cotados em USD fixo (não dependem da moeda do usuário). Mercado AO VIVO: além do mount + foco/rede,
  // faz um POLL a cada 60s enquanto a aba está visível (TTL de 60s no store limita a isso). A chamada
  // é do próprio navegador (por-IP, sem cota mensal), então atualizar de minuto em minuto é seguro.
  useEffect(() => {
    refreshSpot();
    const onWake = () => {
      if (document.visibilityState === "visible") refreshSpot();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    const poll = window.setInterval(onWake, 60_000);
    return () => {
      clearInterval(poll);
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

  // Auto-rolagem via scrollLeft (no lugar da animação CSS) pra permitir ARRASTAR o ticker. Ao passar
  // a largura de 1 cópia (metade do track duplicado), volta sem emenda. Pausa no hover e no arrasto;
  // desliga o automático em prefers-reduced-motion (arrasto segue). `overflow-hidden` permite scrollLeft.
  useEffect(() => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // Fora da viewport (usuário rolou pra baixo — ou celular, onde o ticker é display:none),
    // o marquee não anima: pula o trabalho de scroll e não suja frame à toa.
    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((es) => {
            visible = es[0]?.isIntersecting ?? true;
          })
        : null;
    io?.observe(vp);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp p/ aba em 2º plano não dar salto
      last = now;
      const half = track.scrollWidth / 2 || 1;
      // Avança e, ao passar a largura de 1 cópia, volta pro início sem emenda (módulo). O automático
      // só cresce, então o módulo basta; o arrasto (que pode ir pra trás) trata o sentido negativo.
      if (!reduce && visible && !hoverRef.current && !dragRef.current.active) {
        vp.scrollLeft = (vp.scrollLeft + 42 * dt) % half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [items]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const vp = viewportRef.current;
    if (!vp) return;
    dragRef.current = { active: true, startX: e.clientX, startScroll: vp.scrollLeft };
    vp.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!d.active || !vp || !track) return;
    // Wrap nos DOIS sentidos: scrollLeft clampa em ≥0, então mapeamos o alvo pra [0, half) via módulo
    // em vez de deixar bater a parede no início — arrastar pra qualquer lado dá a volta sem emenda.
    const half = track.scrollWidth / 2 || 1;
    const target = d.startScroll - (e.clientX - d.startX);
    vp.scrollLeft = ((target % half) + half) % half;
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    viewportRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const content = items.filter((i) => i.kind !== "divider").length;
  if (content === 0) return null;

  return (
    <div className="hidden lg:flex sticky top-0 z-30 h-[62px] -mb-[62px] items-center">
      <div className="w-full max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14">
        <div
          ref={viewportRef}
          onMouseEnter={() => (hoverRef.current = true)}
          onMouseLeave={() => (hoverRef.current = false)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="ticker-viewport ticker-mask overflow-hidden rounded-full border border-border bg-[color-mix(in_oklab,var(--card-2)_70%,transparent)] backdrop-blur-xl shadow-[0_6px_24px_-20px_rgba(0,0,0,0.35)] cursor-grab select-none touch-pan-y active:cursor-grabbing">
          <div ref={trackRef} className="flex w-max">
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
