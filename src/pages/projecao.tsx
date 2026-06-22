import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Line, Area, ComposedChart, ResponsiveContainer, Tooltip, XAxis, ReferenceLine } from "recharts";
import { Flame, Dices } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection, SCENARIO_KEYS, type ScenarioKey } from "@/store/projection";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useFireTarget } from "@/hooks/use-fire-target";
import { actions } from "@/data/actions";
import { convert, formatMoney, groupNumber, parseNumber, type Currency } from "@/money/currency";
import { projectBalance, realValue } from "@/finance/projection";
import { realReturn, safeMonthlyIncome, yearsToFI } from "@/finance/fire";
import { simulateAccumulation, simulateDecumulation, type MonteCarloBand } from "@/finance/montecarlo";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
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
  // Trocar a moeda de exibição reseta o saldo inicial customizado (vive na moeda atual; o
  // custo-alvo NÃO precisa — fica salvo em moeda principal).
  useEffect(() => {
    p.setInitialOverride(null);
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

      {/* Número FIRE — independência financeira */}
      <FireCard />

      {/* Curva determinística + Monte Carlo (acumulação) lado a lado — mesmo horizonte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 items-start">
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
        <MonteCarloAccumCard />
      </div>

      {/* Monte Carlo — aposentadoria (sustentabilidade na decumulação) */}
      <MonteCarloRetireCard />

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
  const fire = useFireTarget();
  const v = useMemo(() => {
    const initial = p.initialOverride ?? netWorth;
    const years = Math.max(1, Math.min(60, Math.round(p.years)));
    const b = p.scenarios.base;
    const nominal = projectBalance(initial, b.monthly, b.annualReturn / 100, years);
    // Número da independência — fonte única (idêntico à aba Liberdade e ao relatório).
    const target = fire?.independenceNumber ?? Infinity;
    // % FIRE mede sobre o patrimônio INVESTÍVEL (= Liberdade), não o total da projeção.
    const fireProgress =
      fire && fire.annualCost > 0 && Number.isFinite(target) && target > 0 ? (fire.eligibleWealth / target) * 100 : null;
    return { years, nominal, real: realValue(nominal, p.annualInflation / 100, years), fireProgress };
  }, [netWorth, fire, p.initialOverride, p.scenarios, p.annualInflation, p.years]);
  return (
    <HeaderKpis>
      <HeaderKpi label={t("projecao.finalNominal", { years: v.years })} tone="accent" value={<Money value={v.nominal} currency={disp} />} />
      <HeaderKpi secondary label={t("projecao.finalReal")} value={<Money value={v.real} currency={disp} />} />
      {v.fireProgress != null ? (
        <HeaderKpi secondary label={t("fire.short")} tone="accent" value={`${Math.round(v.fireProgress)}%`} />
      ) : null}
    </HeaderKpis>
  );
}

/** Card do número FIRE: alvo, progresso, tempo até a IF e renda passiva atual. */
function FireCard() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const baseCur = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const p = useProjection();
  // Número da independência — fonte única (idêntico à aba Liberdade e ao relatório): usa o
  // custo LÍQUIDO (gastos − renda passiva durável) e a mesma janela/taxa.
  const fire = useFireTarget();
  // FIRE (%, tempo até a IF) mede sobre o patrimônio INVESTÍVEL — igual à Liberdade. A regra dos
  // 4% só vale sobre o que dá pra sacar; por isso difere do patrimônio total da curva de projeção.
  const portfolio = fire?.eligibleWealth ?? 0;
  const annualExp = fire?.annualCost ?? 0;
  const monthlyPlan = fire?.monthlyCost ?? 0;       // custo de PLANEJAMENTO (alvo ou orçamento)
  const budgetMonthly = fire?.budgetMonthlyCost ?? 0; // custo ATUAL do orçamento (referência)
  const costFromTarget = fire?.costFromTarget ?? false;
  const coveredByPassive = fire?.coveredByPassive ?? false;
  const swr = p.withdrawalRate;
  const base = p.scenarios.base;

  const target = fire?.independenceNumber ?? Infinity;
  const targetOk = !!fire && fire.annualCost > 0 && Number.isFinite(target) && target > 0;
  const realRet = realReturn(base.annualReturn, p.annualInflation);
  const years = coveredByPassive
    ? 0
    : targetOk
      ? yearsToFI({ portfolio, monthlyContribution: base.monthly, realAnnualReturn: realRet, target })
      : null;
  const progress = coveredByPassive ? 100 : targetOk ? (portfolio / target) * 100 : 0;
  const safeMonthly = safeMonthlyIncome(portfolio, swr);
  const monthlyExp = annualExp / 12;
  const coverage = monthlyExp > 0 ? (safeMonthly / monthlyExp) * 100 : 0;
  const mult = swr > 0 ? 100 / swr : 0;
  const multLabel = mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1);
  const remaining = coveredByPassive ? 0 : targetOk ? Math.max(0, target - portfolio) : 0;
  const targetYear = new Date().getFullYear() + (years != null ? Math.ceil(years) : 0);

  // Custo de vida na independência: editável e PERSISTIDO (moeda principal), com o custo atual
  // do orçamento sempre visível como referência. Vazio/igual = usa o do orçamento.
  const refStr = `${t("fire.currentCost")}: ${formatMoney(budgetMonthly, disp)}/${t("fire.mo")}`;
  const expField = (
    <Field
      label={`${t("fire.targetCost")} (${disp}/${t("fire.mo")})`}
      value={Math.round(monthlyPlan)}
      onChange={(v) => actions.setLiberdade({ targetMonthlyCost: convert(v, disp, baseCur, rates) })}
      hint={costFromTarget ? `${t("projecao.custom")} · ${refStr}` : refStr}
      onReset={costFromTarget ? () => actions.setLiberdade({ targetMonthlyCost: 0 }) : undefined}
      labelClass="min-h-[2.6em] leading-[1.3]"
    />
  );
  const swrField = <Field label={t("fire.withdrawalRate")} value={swr} onChange={(v) => p.set({ withdrawalRate: v })} suffix="%" labelClass="min-h-[2.6em] leading-[1.3]" />;
  const header = (
    <div className="flex items-center gap-2">
      <Flame size={16} className="text-accent shrink-0" />
      <Eyebrow>{t("fire.title")}</Eyebrow>
    </div>
  );
  const hint = <p className="mt-4 text-[11px] text-faint leading-relaxed max-w-2xl">{t("fire.hint")}</p>;

  // Sem gastos no orçamento → não dá pra calcular: convida a preencher (ou informar à mão).
  if (annualExp <= 0) {
    return (
      <Tile className="p-6 md:p-7">
        {header}
        <p className="mt-3 text-[13px] text-muted max-w-md">{t("fire.empty")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-5 max-w-lg">
          {expField}
          {swrField}
        </div>
        {hint}
      </Tile>
    );
  }

  return (
    <Tile className="p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {header}
          <div className="mt-2.5 text-[clamp(1.9rem,5.5vw,2.7rem)] font-semibold tracking-[-0.035em] tabular leading-none">
            <Money value={target} currency={disp} />
          </div>
          <p className="text-[12.5px] text-muted mt-2">
            {coveredByPassive ? t("liberdade.coveredByPassive") : t("fire.subtitle", { mult: multLabel })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="eyebrow block mb-1.5">{t("fire.timeToFi")}</span>
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
          <span className="tabular font-semibold text-accent"><Hidden>{progress >= 100 ? "100%+" : `${Math.round(progress)}%`}</Hidden></span>
        </div>
        <div className="h-2.5 rounded-full bg-bg2 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(progress > 0 ? 2 : 0, progress))}%` }}
          />
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-6">
        <Stat label={t("liberdade.eligible")} value={<Money value={portfolio} currency={disp} />} />
        <Stat
          label={t("fire.passiveNow")}
          value={
            <>
              <Money value={safeMonthly} currency={disp} />
              <span className="text-faint">/{t("fire.mo")}</span>
            </>
          }
          sub={<Hidden>{t("fire.covers", { pct: Math.round(coverage) })}</Hidden>}
          subTone={coverage >= 100 ? "accent" : undefined}
        />
        <Stat label={t("fire.remaining")} value={remaining > 0 ? <Money value={remaining} currency={disp} /> : t("fire.reached")} />
      </div>

      {/* Premissas do FIRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-7 max-w-lg">
        {expField}
        {swrField}
      </div>
      {hint}
    </Tile>
  );
}

/** Presets de volatilidade anual (%) por perfil de risco — evita o usuário ter de saber σ. */
const RISK_PRESETS = [
  { key: "conservative", vol: 8 },
  { key: "moderate", vol: 14 },
  { key: "aggressive", vol: 20 },
] as const;

/** Verde se a chance é alta, neutro se média, vermelho se baixa. */
function probColor(prob: number, dark: boolean): string {
  if (prob >= 0.8) return dark ? "#3ecf8e" : "#15976a";
  if (prob >= 0.6) return "#8a8f98";
  return "#f1746a";
}

/** Chips de perfil de risco (definem a volatilidade do Monte Carlo). Afetam os dois gráficos. */
function RiskChips() {
  const { t } = useTranslation();
  const p = useProjection();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {RISK_PRESETS.map((r) => {
        const on = Math.round(p.annualVolatility) === r.vol;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => p.set({ annualVolatility: r.vol })}
            title={`${r.vol}%`}
            className={cn(
              "h-7 px-2.5 rounded-full border text-[11.5px] font-medium transition-colors",
              on
                ? "border-accent/50 bg-accent-soft text-text"
                : "border-border bg-card2 text-muted hover:text-text hover:bg-card-hover",
            )}
          >
            {t(`montecarlo.${r.key}`)}
          </button>
        );
      })}
    </div>
  );
}

/** Card (Tile) de uma fase do Monte Carlo: título + chance + fan chart (banda P10–P90 + mediana). */
function MonteCard({
  title,
  headline,
  prob,
  note,
  bands,
  target,
  disp,
  trials,
  controls,
}: {
  title: string;
  headline: string;
  prob: number;
  note: string;
  bands: MonteCarloBand[];
  target?: number;
  disp: Currency;
  trials: number;
  controls?: ReactNode;
}) {
  const { t } = useTranslation();
  const dark = useUI((s) => s.theme) === "dark";
  const axis = dark ? "#5f646c" : "#8a8f98";
  const color = probColor(prob, dark);
  const data = bands.map((b) => ({ year: b.year, range: [b.p10, b.p90], p50: b.p50 }));
  const fmt = (v: number) => formatMoney(v, disp);
  return (
    <Tile className="p-6 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Dices size={16} className="text-accent shrink-0" />
          <Eyebrow>{title}</Eyebrow>
        </div>
        {controls}
      </div>
      <p className="mt-3 text-[15px] sm:text-[16px] font-semibold tracking-[-0.01em] tabular leading-snug" style={{ color }}>
        {headline}
      </p>
      <p className="mt-1 text-[11.5px] text-faint leading-relaxed">{note}</p>
      <div className="w-full h-[210px] mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} dy={4} />
            <Tooltip
              formatter={(v) => [fmt(Number(v)), t("montecarlo.median")]}
              labelFormatter={(y) => `${t("montecarlo.year")} ${y}`}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
              labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
            />
            <Area type="monotone" dataKey="range" stroke="none" fill={color} fillOpacity={0.14} tooltipType="none" isAnimationActive={false} />
            <Line type="monotone" dataKey="p50" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            {target != null ? (
              <ReferenceLine
                y={target}
                stroke={axis}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: t("montecarlo.target"), position: "insideTopRight", fontSize: 10, fill: axis }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-[2px] rounded-full" style={{ background: color }} />
          {t("montecarlo.median")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-[2px]" style={{ background: color, opacity: 0.25 }} />
          {t("montecarlo.band")}
        </span>
        <span className="text-faint ml-auto">{t("montecarlo.trials", { n: groupNumber(trials, disp) })}</span>
      </div>
    </Tile>
  );
}

/** Acumulação: chance de o patrimônio investível atingir o número FIRE no horizonte (sempre on). */
function MonteCarloAccumCard() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const p = useProjection();
  const fire = useFireTarget();
  const vol = Math.max(0, p.annualVolatility) / 100;
  const base = p.scenarios.base;
  const realRet = realReturn(base.annualReturn, p.annualInflation);
  const years = Math.max(1, Math.min(60, Math.round(p.years)));
  const target = fire?.independenceNumber ?? Infinity;
  const targetOk = !!fire && Number.isFinite(target) && target > 0;
  const eligible = Math.max(0, fire?.eligibleWealth ?? 0);
  const accum = useMemo(
    () =>
      targetOk
        ? simulateAccumulation({ initial: eligible, monthlyContribution: base.monthly, realAnnualReturn: realRet, annualVolatility: vol, years, target })
        : null,
    [targetOk, eligible, base.monthly, realRet, vol, years, target],
  );
  if (!accum) {
    return (
      <Tile className="p-6 md:p-7">
        <div className="flex items-center gap-2">
          <Dices size={16} className="text-accent shrink-0" />
          <Eyebrow>{t("montecarlo.accumTitle")}</Eyebrow>
        </div>
        <p className="mt-3 text-[13px] text-muted">{t("montecarlo.empty")}</p>
      </Tile>
    );
  }
  return (
    <MonteCard
      title={t("montecarlo.accumTitle")}
      headline={t("montecarlo.accumHeadline", { pct: Math.round(accum.successProb * 100), years })}
      prob={accum.successProb}
      note={t("montecarlo.accumNote")}
      bands={accum.bands}
      target={target}
      disp={disp}
      trials={accum.trials}
      controls={<RiskChips />}
    />
  );
}

/** Aposentadoria: chance de o dinheiro durar a decumulação (risco de sequência de retornos). */
function MonteCarloRetireCard() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const p = useProjection();
  const fire = useFireTarget();
  const vol = Math.max(0, p.annualVolatility) / 100;
  const base = p.scenarios.base;
  const realRet = realReturn(base.annualReturn, p.annualInflation);
  const retYears = Math.max(1, Math.min(60, Math.round(p.retirementYears)));
  const target = fire?.independenceNumber ?? Infinity;
  const netAnnual = fire?.netAnnualCost ?? 0;
  const ready = !!fire && Number.isFinite(target) && target > 0 && netAnnual > 0;
  const decum = useMemo(
    () =>
      ready
        ? simulateDecumulation({ initialPortfolio: target, annualSpending: netAnnual, realAnnualReturn: realRet, annualVolatility: vol, years: retYears })
        : null,
    [ready, target, netAnnual, realRet, vol, retYears],
  );
  if (!decum) return null;
  return (
    <MonteCard
      title={t("montecarlo.retireTitle")}
      headline={t("montecarlo.retireHeadline", { pct: Math.round(decum.survivalProb * 100), years: retYears })}
      prob={decum.survivalProb}
      note={t("montecarlo.retireNote")}
      bands={decum.bands}
      disp={disp}
      trials={decum.trials}
      controls={
        <div className="w-24">
          <Field label={t("montecarlo.retireYears")} value={p.retirementYears} onChange={(v) => p.set({ retirementYears: v })} />
        </div>
      }
    />
  );
}

function Stat({ label, value, sub, subTone }: { label: string; value: ReactNode; sub?: ReactNode; subTone?: "accent" }) {
  return (
    <div className="min-w-0">
      <span className="eyebrow block mb-1">{label}</span>
      <div className="text-[15px] font-semibold tabular truncate">{value}</div>
      {sub ? <span className={cn("text-[11px]", subTone === "accent" ? "text-accent" : "text-faint")}>{sub}</span> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  hint,
  onReset,
  labelClass,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
  onReset?: () => void;
  /** Classe extra no rótulo (ex.: reservar 2 linhas p/ alinhar os inputs num grid). */
  labelClass?: string;
}) {
  const disp = useUI((s) => s.displayCurrency);
  const [v, setV] = useState(() => groupNumber(value, disp));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(groupNumber(value, disp));
  }, [value, focused, disp]);
  const commit = () => {
    const n = parseNumber(v, disp);
    if (!Number.isNaN(n) && n >= 0) onChange(n);
    else setV(groupNumber(value, disp));
  };
  return (
    <label className="block">
      <span className={cn("eyebrow block mb-1.5", labelClass)}>{label}</span>
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
