import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection } from "@/store/projection";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { projectionSeries, projectBalance, realValue } from "@/finance/projection";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

export default function Projecao() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  const p = useProjection();
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";
  const axis = theme === "dark" ? "#5f646c" : "#8a8f98";

  const netWorth = useMemo(() => {
    if (!data) return 0;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const assets = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const liab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    return assets - liab;
  }, [data, disp, rates]);

  // Valor inicial: patrimônio atual por padrão; override no store (compartilhado com o
  // KPI do header), só em memória. Ao trocar a moeda, descarta o override (volta ao
  // patrimônio já convertido) pra não projetar um número fixo numa moeda diferente.
  const override = p.initialOverride;
  useEffect(() => p.setInitialOverride(null), [disp]); // eslint-disable-line react-hooks/exhaustive-deps
  const initial = override ?? netWorth;
  const years = Math.max(1, Math.min(60, Math.round(p.years)));

  const series = useMemo(
    () =>
      projectionSeries({
        initial,
        monthlyContribution: p.monthly,
        annualReturn: p.annualReturn / 100,
        annualInflation: p.annualInflation / 100,
        years,
      }),
    [initial, p.monthly, p.annualReturn, p.annualInflation, years],
  );

  const fmt = (v: number) => formatMoney(v, disp);

  return (
    <div className="space-y-7">
      {/* Premissas */}
      <Tile className="p-6 md:p-7">
        <Eyebrow>{t("projecao.assumptions")}</Eyebrow>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-5 mt-4">
          <Field label={`${t("projecao.initial")} (${disp})`} value={Math.round(initial)} onChange={(v) => p.setInitialOverride(v)} hint={override != null ? t("projecao.custom") : t("projecao.fromNetWorth")} onReset={override != null ? () => p.setInitialOverride(null) : undefined} />
          <Field label={`${t("projecao.monthly")} (${disp})`} value={p.monthly} onChange={(v) => p.set({ monthly: v })} />
          <Field label={t("projecao.annualReturn")} value={p.annualReturn} onChange={(v) => p.set({ annualReturn: v })} suffix="%" />
          <Field label={t("projecao.inflation")} value={p.annualInflation} onChange={(v) => p.set({ annualInflation: v })} suffix="%" />
          <Field label={t("projecao.years")} value={p.years} onChange={(v) => p.set({ years: v })} />
        </div>
      </Tile>

      {/* Curva */}
      <Tile className="p-6 md:p-7">
        <Eyebrow className="mb-4">{t("projecao.curve")}</Eyebrow>
        <div className="w-full h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <defs>
                <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} dy={4} />
              <Tooltip
                formatter={(v, name) => [fmt(Number(v)), name === "nominal" ? t("projecao.nominal") : t("projecao.real")]}
                labelFormatter={(y) => `${t("projecao.year")} ${y}`}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
              />
              <Area type="monotone" dataKey="real" stroke={axis} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
              <Area type="monotone" dataKey="nominal" stroke={accent} strokeWidth={2} fill="url(#projGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-5 mt-3 text-[11.5px] text-faint">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[2px] bg-accent" />{t("projecao.nominal")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-faint" />{t("projecao.real")}</span>
        </div>
      </Tile>

      {/* Tabela ano a ano */}
      <section>
        <Eyebrow>{t("projecao.yearByYear")}</Eyebrow>
        <div className="mt-3 rounded-[16px] border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[440px]">
              <div className="grid grid-cols-[0.6fr_1fr_1fr] bg-card2 border-b border-border px-4 py-2.5">
                <Eyebrow>{t("projecao.year")}</Eyebrow>
                <Eyebrow className="text-right">{t("projecao.nominal")}</Eyebrow>
                <Eyebrow className="text-right">{t("projecao.real")}</Eyebrow>
              </div>
              {series.map((s) => (
                <div key={s.year} className="grid grid-cols-[0.6fr_1fr_1fr] items-center px-4 py-2 border-b border-[var(--grid-line)] last:border-0">
                  <span className="text-[13px] tabular text-muted">{s.year}</span>
                  <Money value={s.nominal} currency={disp} className="text-right text-[13px] tabular" />
                  <Money value={s.real} currency={disp} className="text-right text-[13px] tabular text-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** KPIs do cabeçalho do accordion de Projeção (projeção a partir do patrimônio atual). */
export function ProjecaoSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  const p = useProjection();
  const v = useMemo(() => {
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const netWorth = data
      ? data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0) -
        data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0)
      : 0;
    const initial = p.initialOverride ?? netWorth;
    const years = Math.max(1, Math.min(60, Math.round(p.years)));
    const nominal = projectBalance(initial, p.monthly, p.annualReturn / 100, years);
    return { years, nominal, real: realValue(nominal, p.annualInflation / 100, years) };
  }, [data, disp, rates, p.initialOverride, p.monthly, p.annualReturn, p.annualInflation, p.years]);
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
          className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[14px] tabular outline-none focus:border-accent"
        />
        {suffix ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span> : null}
      </div>
      {hint ? (
        <span className="flex items-center gap-2 mt-1 text-[11px] text-faint">
          {hint}
          {onReset ? (
            <button type="button" onClick={onReset} className="text-accent hover:underline">
              {/* volta ao patrimônio */}↺
            </button>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
