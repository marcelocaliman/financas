import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Line, Area, ComposedChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Flame } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection, SCENARIO_KEYS, type ScenarioKey } from "@/store/projection";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useBudget } from "@/hooks/use-budget";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { projectBalance, realValue } from "@/finance/projection";
import { fireNumber, realReturn, safeMonthlyIncome, yearsToFI } from "@/finance/fire";
import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { Card, CardHead, PageTitle, SectionGroup, CardGrid, StatCard, Label } from "../ui";

const SCENARIO_COLOR: Record<ScenarioKey, string> = {
  optimistic: "#15976a",
  base: "#8a8f98",
  pessimistic: "#ef5e6f",
};

/** Patrimônio líquido (ativos − passivos) convertido para a moeda de exibição. */
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

/** Gastos anuais derivados do orçamento: média mensal sobre os meses COM lançamento × 12. */
function useAnnualExpenses(): number {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useBudget();
  return useMemo(() => {
    if (!data) return 0;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const months = new Set(data.expenses.map((e) => e.month));
    if (months.size === 0) return 0;
    const total = data.expenses.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    return (total / months.size) * 12;
  }, [data, disp, rates]);
}

export default function ProjecaoV2() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const axis = theme === "dark" ? "#5f646c" : "#8a8f98";
  const p = useProjection();
  const netWorth = useNetWorth();
  const derivedAnnual = useAnnualExpenses();

  const override = p.initialOverride;
  // Trocar a moeda de exibição reseta os overrides em valor (eles vivem na moeda atual).
  useEffect(() => {
    p.setInitialOverride(null);
    p.setAnnualExpensesOverride(null);
  }, [disp]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // KPIs do topo: cenário-base nominal, em valor de hoje, e progresso FIRE.
  const baseNominal = projectBalance(initial, sc.base.monthly, sc.base.annualReturn / 100, years);
  const baseReal = realValue(baseNominal, p.annualInflation / 100, years);
  const annualExp = p.annualExpensesOverride ?? derivedAnnual;
  const fireTarget = fireNumber(annualExp, p.withdrawalRate);
  const fireProgress = annualExp > 0 && Number.isFinite(fireTarget) && fireTarget > 0 ? (initial / fireTarget) * 100 : null;

  return (
    <div>
      <PageTitle title={t("nav.projecao")} subtitle={t("projecao.curve")} />

      {/* KPIs do topo */}
      <CardGrid className="mb-8">
        <StatCard label={t("projecao.finalNominal", { years })} tone="accent" value={<Money value={baseNominal} currency={disp} />} sub={t("projecao.base")} />
        <StatCard label={t("projecao.finalReal")} value={<Money value={baseReal} currency={disp} />} sub={t("projecao.inflation")} />
        <StatCard label={t("fire.short")} value={fireProgress != null ? `${Math.round(fireProgress)}%` : "—"} tone="accent" sub={t("fire.progress")} icon={<Flame size={16} />} />
        <StatCard label={t("projecao.years")} value={String(years)} sub={t("projecao.assumptions")} />
      </CardGrid>

      {/* Premissas */}
      <SectionGroup title={t("projecao.assumptions")}>
        <CardGrid>
          <Card className="p-6">
            <CardHead>{t("projecao.assumptions")}</CardHead>
            <div className="grid grid-cols-1 gap-4">
              <NumberField
                label={`${t("projecao.initial")} (${disp})`}
                value={Math.round(initial)}
                onChange={(v) => p.setInitialOverride(v)}
                hint={override != null ? t("projecao.custom") : t("projecao.fromNetWorth")}
                onReset={override != null ? () => p.setInitialOverride(null) : undefined}
              />
              <NumberField label={t("projecao.inflation")} value={p.annualInflation} onChange={(v) => p.set({ annualInflation: v })} suffix="%" />
              <NumberField label={t("projecao.years")} value={p.years} onChange={(v) => p.set({ years: v })} />
            </div>
          </Card>

          {SCENARIO_KEYS.map((k) => (
            <Card key={k} className="p-6">
              <CardHead right={<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SCENARIO_COLOR[k] }} />}>
                {t(`projecao.${k}`)}
              </CardHead>
              <div className="grid grid-cols-1 gap-4">
                <NumberField label={t("projecao.annualReturn")} value={sc[k].annualReturn} onChange={(v) => p.setScenario(k, { annualReturn: v })} suffix="%" />
                <NumberField label={`${t("projecao.monthly")} (${disp})`} value={sc[k].monthly} onChange={(v) => p.setScenario(k, { monthly: v })} />
              </div>
            </Card>
          ))}
        </CardGrid>
      </SectionGroup>

      {/* Número FIRE */}
      <SectionGroup title={t("fire.title")}>
        <FireCard portfolio={initial} derivedAnnual={derivedAnnual} />
      </SectionGroup>

      {/* Projeção: curva + tabela */}
      <SectionGroup title={t("projecao.curve")}>
        <CardGrid>
          <Card className="p-6 xl:col-span-2 2xl:col-span-3">
            <CardHead
              right={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
                  {[...SCENARIO_KEYS].reverse().map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-[2px] rounded-full" style={{ background: SCENARIO_COLOR[k] }} />
                      <span className="text-muted">{t(`projecao.${k}`)}</span>
                      <span className="tabular text-text font-medium">{fmt(last[k])}</span>
                    </span>
                  ))}
                </div>
              }
            >
              {t("projecao.curve")}
            </CardHead>
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                  <defs>
                    <linearGradient id="projGradV2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SCENARIO_COLOR.base} stopOpacity={0.14} />
                      <stop offset="100%" stopColor={SCENARIO_COLOR.base} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} dy={4} />
                  <Tooltip
                    formatter={(v, name) => [fmt(Number(v)), t(`projecao.${name as string}`)]}
                    labelFormatter={(y) => `${t("projecao.year")} ${y}`}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-float)" }}
                    labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
                  />
                  <Area type="monotone" dataKey="base" stroke="none" fill="url(#projGradV2)" tooltipType="none" />
                  <Line type="monotone" dataKey="optimistic" stroke={SCENARIO_COLOR.optimistic} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="base" stroke={SCENARIO_COLOR.base} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pessimistic" stroke={SCENARIO_COLOR.pessimistic} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 xl:col-span-3 2xl:col-span-4">
            <CardHead>{t("projecao.yearByYear")}</CardHead>
            <div className="overflow-x-auto">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr] pb-2.5 border-b border-border">
                  <Label>{t("projecao.year")}</Label>
                  {SCENARIO_KEYS.map((k) => (
                    <Label key={k} className="text-right">
                      {t(`projecao.${k}`)}
                    </Label>
                  ))}
                </div>
                <div className="divide-y divide-[var(--grid-line)]">
                  {series.map((s) => (
                    <div key={s.year} className="grid grid-cols-[0.6fr_1fr_1fr_1fr] items-center py-2">
                      <span className="text-[13px] tabular text-muted">{s.year}</span>
                      {SCENARIO_KEYS.map((k) => (
                        <Money key={k} value={s[k]} currency={disp} className={cn("text-right text-[13px] tabular", k === "base" ? "text-text" : "text-muted")} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </CardGrid>
      </SectionGroup>
    </div>
  );
}

/** Card do número FIRE: alvo, progresso, tempo até a IF e renda passiva atual. */
function FireCard({ portfolio, derivedAnnual }: { portfolio: number; derivedAnnual: number }) {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const p = useProjection();
  const annualExp = p.annualExpensesOverride ?? derivedAnnual;
  const swr = p.withdrawalRate;
  const base = p.scenarios.base;

  const target = fireNumber(annualExp, swr);
  const targetOk = annualExp > 0 && Number.isFinite(target) && target > 0;
  const realRet = realReturn(base.annualReturn, p.annualInflation);
  const years = targetOk ? yearsToFI({ portfolio, monthlyContribution: base.monthly, realAnnualReturn: realRet, target }) : null;
  const progress = targetOk ? (portfolio / target) * 100 : 0;
  const safeMonthly = safeMonthlyIncome(portfolio, swr);
  const monthlyExp = annualExp / 12;
  const coverage = monthlyExp > 0 ? (safeMonthly / monthlyExp) * 100 : 0;
  const mult = swr > 0 ? 100 / swr : 0;
  const multLabel = mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1);
  const remaining = targetOk ? Math.max(0, target - portfolio) : 0;
  const targetYear = new Date().getFullYear() + (years != null ? Math.ceil(years) : 0);

  const expField = (
    <NumberField
      label={`${t("fire.annualExpenses")} (${disp})`}
      value={Math.round(annualExp)}
      onChange={(v) => p.setAnnualExpensesOverride(v)}
      hint={p.annualExpensesOverride != null ? t("projecao.custom") : t("fire.fromBudget")}
      onReset={p.annualExpensesOverride != null ? () => p.setAnnualExpensesOverride(null) : undefined}
    />
  );
  const swrField = <NumberField label={t("fire.withdrawalRate")} value={swr} onChange={(v) => p.set({ withdrawalRate: v })} suffix="%" />;
  const hint = <p className="mt-4 text-[11px] text-faint leading-relaxed max-w-2xl">{t("fire.hint")}</p>;

  // Sem gastos no orçamento → não dá pra calcular: convida a preencher (ou informar à mão).
  if (annualExp <= 0) {
    return (
      <Card className="p-6">
        <CardHead right={<Flame size={16} className="text-accent" />}>{t("fire.title")}</CardHead>
        <p className="text-[13px] text-muted max-w-md">{t("fire.empty")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 max-w-lg">
          {expField}
          {swrField}
        </div>
        {hint}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <CardHead right={<Flame size={16} className="text-accent" />}>{t("fire.title")}</CardHead>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="text-[clamp(1.9rem,5.5vw,2.7rem)] font-semibold tracking-[-0.035em] tabular leading-none">
            <Money value={target} currency={disp} />
          </div>
          <p className="text-[12.5px] text-muted mt-2">{t("fire.subtitle", { mult: multLabel })}</p>
        </div>
        <div className="text-right shrink-0">
          <Label className="block mb-1.5">{t("fire.timeToFi")}</Label>
          {years == null ? (
            <div className="text-[clamp(1.4rem,4vw,1.9rem)] font-semibold text-faint tabular leading-none">—</div>
          ) : years === 0 ? (
            <div className="text-[clamp(1.4rem,4vw,1.9rem)] font-semibold text-accent tracking-[-0.02em] leading-none">{t("fire.reached")}</div>
          ) : (
            <>
              <div className="text-[clamp(1.4rem,4vw,1.9rem)] font-semibold tabular leading-none">{t("fire.yearsValue", { n: years.toFixed(1) })}</div>
              <span className="text-[11.5px] text-faint">≈ {targetYear}</span>
            </>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-[12px] mb-2">
          <span className="text-muted">{t("fire.progress")}</span>
          <span className="tabular font-semibold text-accent">{progress >= 100 ? "100%+" : `${Math.round(progress)}%`}</span>
        </div>
        <div className="h-2.5 rounded-full bg-card2 overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(progress > 0 ? 2 : 0, progress))}%` }} />
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-6">
        <Stat label={t("fire.portfolio")} value={<Money value={portfolio} currency={disp} />} />
        <Stat
          label={t("fire.passiveNow")}
          value={
            <>
              <Money value={safeMonthly} currency={disp} />
              <span className="text-faint">/{t("fire.mo")}</span>
            </>
          }
          sub={t("fire.covers", { pct: Math.round(coverage) })}
          subTone={coverage >= 100 ? "accent" : undefined}
        />
        <Stat label={t("fire.remaining")} value={remaining > 0 ? <Money value={remaining} currency={disp} /> : t("fire.reached")} />
      </div>

      {/* Premissas do FIRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7 max-w-lg">
        {expField}
        {swrField}
      </div>
      {hint}
    </Card>
  );
}

function Stat({ label, value, sub, subTone }: { label: string; value: React.ReactNode; sub?: string; subTone?: "accent" }) {
  return (
    <div className="min-w-0">
      <Label className="block mb-1">{label}</Label>
      <div className="text-[15px] font-semibold tabular truncate">{value}</div>
      {sub ? <span className={cn("text-[11px]", subTone === "accent" ? "text-accent" : "text-faint")}>{sub}</span> : null}
    </div>
  );
}

function NumberField({
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
      <Label className="block mb-1.5">{label}</Label>
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
          className="w-full h-10 px-3 rounded-[10px] border border-border bg-card text-[14px] tabular outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
        />
        {suffix ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span> : null}
      </div>
      {hint ? (
        <span className="flex items-center gap-2 mt-1 text-[11px] text-faint">
          {hint}
          {onReset ? (
            <button type="button" onClick={onReset} aria-label={label} className="text-accent hover:underline">
              ↺
            </button>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
