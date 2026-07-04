import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { convert, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { Kpi } from "@/components/common/kpi";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { cn } from "@/lib/utils";

/** Exposição cambial do patrimônio: líquido por moeda, convertido pra principal. */
export function useFxExposure() {
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  return useMemo(() => {
    if (!data) return { rows: [] as { currency: Currency; principal: number }[], total: 0, foreign: 0, magnitude: 0 };
    const net = new Map<Currency, number>();
    for (const a of data.assets) net.set(a.currency, (net.get(a.currency) ?? 0) + a.amount);
    for (const l of data.liabilities) net.set(l.currency, (net.get(l.currency) ?? 0) - l.amount);
    const rows = [...net.entries()]
      .map(([currency, native]) => ({ currency, principal: convert(native, currency, base, rates) }))
      .filter((x) => Math.abs(x.principal) > 0.5)
      .sort((a, b) => Math.abs(b.principal) - Math.abs(a.principal));
    const total = rows.reduce((s, x) => s + x.principal, 0);
    const foreign = rows.filter((x) => x.currency !== base).reduce((s, x) => s + x.principal, 0);
    // Soma das MAGNITUDES — base das %, sempre coerente mesmo com passivo (líquido negativo).
    const magnitude = rows.reduce((s, x) => s + Math.abs(x.principal), 0);
    return { rows, total, foreign, magnitude };
  }, [data, base, rates]);
}

export default function CrossBorder() {
  const base = useUI((s) => s.baseCurrency);
  const fx = useFxExposure();

  return (
    <div className="space-y-6 sm:space-y-8">
      <FxImpact base={base} fx={fx} />
    </div>
  );
}

function FxImpact({ base, fx }: { base: Currency; fx: ReturnType<typeof useFxExposure> }) {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const [pct, setPct] = useState(10);
  const toDisp = (v: number) => convert(v, base, disp, rates);

  if (fx.rows.length === 0) {
    return (
      <section>
        <Eyebrow>{t("crossborder.fxTitle")}</Eyebrow>
        <p className="text-[13px] text-faint mt-3">{t("crossborder.fxEmpty")}</p>
      </section>
    );
  }

  const foreignDisp = toDisp(fx.foreign);
  const swing = Math.abs(foreignDisp) * (pct / 100); // impacto de ±pct% nas moedas estrangeiras
  const totalDisp = toDisp(fx.total);
  // Tem patrimônio, mas tudo na moeda principal? Então NÃO há exposição cambial: a sensibilidade
  // (oscilação/faixa) seria sempre zero — mostramos um aviso claro em vez de "±0" confuso.
  const hasForeign = fx.rows.some((r) => r.currency !== base);

  return (
    <section className="space-y-4">
      <div>
        <Eyebrow>{t("crossborder.fxTitle")}</Eyebrow>
        <p className="text-[12px] text-muted mt-1 max-w-xl leading-relaxed">
          {hasForeign ? t("crossborder.fxHint") : t("crossborder.fxHintSingle", { base })}
        </p>
      </div>

      {/* Exposição por moeda */}
      <Tile className="p-4 sm:p-6 md:p-7 space-y-3.5">
        {fx.rows.map((r) => {
          const share = fx.magnitude > 0 ? (Math.abs(r.principal) / fx.magnitude) * 100 : 0;
          const foreign = r.currency !== base;
          const negative = r.principal < 0; // líquido devedor nessa moeda
          return (
            <div key={r.currency}>
              <div className="flex items-center justify-between gap-3 mb-1.5 text-[13px]">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn("chip", `chip-${r.currency}`)}>{CURRENCY_SYMBOL[r.currency]}</span>
                  <span className="truncate">{r.currency}</span>
                  {!foreign ? <span className="eyebrow text-faint">{t("crossborder.principal")}</span> : null}
                </span>
                <span className="flex items-center gap-2 tabular shrink-0">
                  <Money value={toDisp(r.principal)} currency={disp} className={cn("font-medium", negative && "text-neg")} />
                  <span className={cn("w-12 text-right", foreign ? "text-muted" : "text-faint")}><Hidden>{Math.round(share) + "%"}</Hidden></span>
                </span>
              </div>
              <div className="h-[7px] rounded-full bg-card2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share}%`, background: negative ? "var(--neg)" : foreign ? "#8a8f98" : "var(--accent)" }}
                />
              </div>
            </div>
          );
        })}
      </Tile>

      {/* Sensibilidade ao câmbio — só faz sentido com moeda estrangeira (senão a oscilação é sempre 0) */}
      {hasForeign ? (
      <Tile className="p-4 sm:p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>{t("crossborder.sensitivity")}</Eyebrow>
            <p className="text-[12px] text-muted mt-1 max-w-md leading-relaxed">
              {t("crossborder.sensitivityHint", { pct })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              aria-label={t("crossborder.move")}
              className="w-40 accent-accent"
            />
            <span className="tabular text-[14px] font-semibold w-12 text-right">±{pct}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
          <Kpi label={t("crossborder.foreignExposure")} value={<Money value={foreignDisp} currency={disp} />} />
          <Kpi label={t("crossborder.swing")} tone="text" value={<><span className="text-muted">±</span><Money value={swing} currency={disp} /></>} />
          <Kpi
            label={t("crossborder.range")}
            value={
              <span className="text-[15px]">
                <Money value={totalDisp - swing} currency={disp} className="text-neg" /> –{" "}
                <Money value={totalDisp + swing} currency={disp} className="text-accent" />
              </span>
            }
          />
        </div>
      </Tile>
      ) : null}
    </section>
  );
}

/** KPI do cabeçalho do accordion: quanto do patrimônio está em moeda estrangeira. */
export function CrossBorderSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const fx = useFxExposure();
  const pct = fx.magnitude > 0 ? (Math.abs(fx.foreign) / fx.magnitude) * 100 : 0;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("crossborder.foreignExposure")} value={<Money value={convert(fx.foreign, base, disp, rates)} currency={disp} />} />
      <HeaderKpi secondary label={t("crossborder.foreignShare")} value={`${Math.round(pct)}%`} />
      {/* Diversificação cambial: útil mesmo sem exposição estrangeira (1 moeda) — evita o relance 0/0% vazio. */}
      <HeaderKpi secondary label={t("crossborder.currencies")} value={<span className="tabular">{fx.rows.length}</span>} />
    </HeaderKpis>
  );
}
