import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Line, Area, ComposedChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection, SCENARIO_KEYS, type ScenarioKey } from "@/store/projection";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { projectBalance, realValue } from "@/finance/projection";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { cn } from "@/lib/utils";

/** Cor de cada cenário (otimista = acento; base = neutro; pessimista = negativo). */
function scenarioColor(key: ScenarioKey, dark: boolean): string {
  if (key === "optimistic") return dark ? "#3ecf8e" : "#15976a";
  if (key === "pessimistic") return "#f1746a";
  return "#8a8f98";
}

function useNetWorth(): number {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  return useMemo(() => {
    if (!data) return 0;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    return (
      data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0) -
      data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0)
    );
  }, [data, disp, rates]);
}

export default function Projecao() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const dark = theme === "dark";
  const axis = dark ? "#5f646c" : "#8a8f98";
  const p = useProjection();
  const netWorth = useNetWorth();

  const override = p.initialOverride;
  useEffect(() => p.setInitialOverride(null), [disp]); // eslint-disable-line react-hooks/exhaustive-deps
  const initial = override ?? netWorth;
  const years = Math.max(1, Math.min(60, Math.round(p.years)));
  const sc = p.scenarios;

  const series = useMemo(() => {
    const arr: Record<string, number>[] = [];
    for (let yr = 0; yr <= years; yr++) {
      const row: Record<string, number> = { year: yr };
      for (const k of SCENARIO_KEYS) row[k] = projectBalance(initial, sc[k].monthly, sc[k].annualReturn / 100, yr);
      arr.push(row);
    }
    return arr;
  }, [initial, sc, years]);

  const last = series[series.length - 1];
  const fmt = (v: number) => formatMoney(v, disp);

  return (
    <div className="space-y-7">
      {/* Premissas */}
      <Tile className="p-6 md:p-7">
        <Eyebrow>{t("projecao.assumptions")}</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5 mt-4 max-w-2xl">
          <Field
            label={`${t("projecao.initial")} (${disp})`}
            value={Math.round(initial)}
            onChange={(v) => p.setInitialOverride(v)}
            hint={override != null ? t("projecao.custom") : t("projecao.fromNetWorth")}
            onReset={override != null ? () => p.setInitialOverride(null) : undefined}
          />
          <Field label={t("projecao.inflation")} value={p.annualInflation} onChange={(v) => p.set({ annualInflation: v })} suffix="%" />
          <Field label={t("projecao.years")} value={p.years} onChange={(v) => p.set({ years: v })} />
        </div>

        <Eyebrow className="mt-7 mb-3">{t("projecao.scenarios")}</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SCENARIO_KEYS.map((k) => (
            <div key={k} className="rounded-[14px] border border-border bg-bg2 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: scenarioColor(k, dark) }} />
                <span className="text-[13.5px] font-semibold">{t(`projecao.${k}`)}</span>
              </div>
              <div className="space-y-3">
                <Field label={t("projecao.annualReturn")} value={sc[k].annualReturn} onChange={(v) => p.setScenario(k, { annualReturn: v })} suffix="%" />
                <Field label={`${t("projecao.monthly")} (${disp})`} value={sc[k].monthly} onChange={(v) => p.setScenario(k, { monthly: v })} />
              </div>
            </div>
          ))}
        </div>
      </Tile>

      {/* Curva comparativa */}
      <Tile className="p-6 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Eyebrow>{t("projecao.curve")}</Eyebrow>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px]">
            {[...SCENARIO_KEYS].reverse().map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="w-3 h-[2px] rounded-full" style={{ background: scenarioColor(k, dark) }} />
                <span className="text-muted">{t(`projecao.${k}`)}</span>
                <span className="tabular text-text font-medium">{fmt(last[k])}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="w-full h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <defs>
                <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={scenarioColor("base", dark)} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={scenarioColor("base", dark)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} dy={4} />
              <Tooltip
                formatter={(v, name) => [fmt(Number(v)), t(`projecao.${name as string}`)]}
                labelFormatter={(y) => `${t("projecao.year")} ${y}`}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
              />
              <Area type="monotone" dataKey="base" stroke="none" fill="url(#projGrad)" tooltipType="none" />
              <Line type="monotone" dataKey="optimistic" stroke={scenarioColor("optimistic", dark)} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="base" stroke={scenarioColor("base", dark)} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pessimistic" stroke={scenarioColor("pessimistic", dark)} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Tile>

      {/* Tabela ano a ano (3 cenários) */}
      <section>
        <Eyebrow>{t("projecao.yearByYear")}</Eyebrow>
        <div className="mt-3 rounded-[16px] border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr] bg-card2 border-b border-border px-4 py-2.5">
                <Eyebrow>{t("projecao.year")}</Eyebrow>
                {SCENARIO_KEYS.map((k) => (
                  <Eyebrow key={k} className="text-right">
                    {t(`projecao.${k}`)}
                  </Eyebrow>
                ))}
              </div>
              {series.map((s) => (
                <div key={s.year} className="grid grid-cols-[0.6fr_1fr_1fr_1fr] items-center px-4 py-2 border-b border-[var(--grid-line)] last:border-0">
                  <span className="text-[13px] tabular text-muted">{s.year}</span>
                  {SCENARIO_KEYS.map((k) => (
                    <Money key={k} value={s[k]} currency={disp} className={cn("text-right text-[13px] tabular", k === "base" ? "text-text" : "text-muted")} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** KPIs do cabeçalho do accordion de Projeção (cenário-base a partir do patrimônio atual). */
export function ProjecaoSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const p = useProjection();
  const netWorth = useNetWorth();
  const v = useMemo(() => {
    const initial = p.initialOverride ?? netWorth;
    const years = Math.max(1, Math.min(60, Math.round(p.years)));
    const b = p.scenarios.base;
    const nominal = projectBalance(initial, b.monthly, b.annualReturn / 100, years);
    return { years, nominal, real: realValue(nominal, p.annualInflation / 100, years) };
  }, [netWorth, p.initialOverride, p.scenarios, p.annualInflation, p.years]);
  return (
    <HeaderKpis>
      <HeaderKpi label={t("projecao.finalNominal", { years: v.years })} tone="accent" value={<Money value={v.nominal} currency={disp} />} />
      <HeaderKpi secondary label={t("projecao.finalReal")} value={<Money value={v.real} currency={disp} />} />
    </HeaderKpis>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  hint,
  onReset,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
  onReset?: () => void;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(String(value));
  }, [value, focused]);
  const commit = () => {
    const n = Number(v.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) onChange(n);
    else setV(String(value));
  };
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      <div className="relative">
        <input
          inputMode="decimal"
          value={v}
          onFocus={(e) => {
            setFocused(true);
            e.currentTarget.select();
          }}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[14px] tabular outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
        />
        {suffix ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span> : null}
      </div>
      {hint ? (
        <span className="flex items-center gap-2 mt-1 text-[11px] text-faint">
          {hint}
          {onReset ? (
            <button type="button" onClick={onReset} aria-label="Voltar ao patrimônio atual" className="text-accent hover:underline">
              ↺
            </button>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
