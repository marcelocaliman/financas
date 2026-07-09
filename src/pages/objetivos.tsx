import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection } from "@/store/projection";
import { useObjetivos } from "@/hooks/use-objetivos";
import { actions } from "@/data/actions";
import { convert, type Currency } from "@/money/currency";
import { realReturn, yearsToFI } from "@/finance/fire";
import { addMonthsLabel } from "@/finance/liberdade";
import type { Goal } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { ProgressRing } from "@/components/common/progress-ring";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

/** "AAAA-MM" → "mmm de AAAA" no idioma corrente. */
function monthLabel(ym: string, lang: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(lang, { month: "short", year: "numeric" });
}

export default function Objetivos() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const data = useObjetivos();
  // Premissas da Projeção (aporte/retorno/inflação) reusadas p/ a "data de chegada" da meta.
  const baseScenario = useProjection((s) => s.scenarios.base);
  const inflation = useProjection((s) => s.annualInflation);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const realRet = realReturn(baseScenario.annualReturn, inflation);
    const cards = data
      .map((g) => {
        const target = conv(g.target, g.currency);
        const current = conv(g.current, g.currency);
        const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
        const remaining = Math.max(0, target - current);
        const done = target > 0 && current >= target;
        const years = target > 0 ? yearsToFI({ portfolio: current, monthlyContribution: baseScenario.monthly, realAnnualReturn: realRet, target }) : null;
        const arrival = done ? "done" : years == null ? null : monthLabel(addMonthsLabel(new Date(), Math.round(years * 12)), lang);
        return { ...g, target, current, pct, remaining, done, arrival };
      })
      .sort((a, b) => b.pct - a.pct); // mais perto da conclusão primeiro (momentum)
    const totalSaved = cards.reduce((s, g) => s + g.current, 0);
    const totalTarget = cards.reduce((s, g) => s + g.target, 0);
    const totalRemaining = cards.reduce((s, g) => s + g.remaining, 0);
    const totalPct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
    const doneCount = cards.filter((g) => g.done).length;
    return { cards, totalSaved, totalTarget, totalRemaining, totalPct, doneCount };
  }, [data, disp, rates, baseScenario, inflation, lang]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }
  const { cards } = view;

  const cols: GridColumn<Goal>[] = [
    { key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.7fr)", placeholder: t("objetivos.namePlaceholder") },
    { key: "current", type: "money", header: t("objetivos.current"), width: "minmax(140px,1fr)", align: "right", currencyKey: "currency" },
    { key: "target", type: "money", header: t("objetivos.target"), width: "minmax(140px,1fr)", align: "right", currencyKey: "currency" },
    { key: "deadline", type: "text", header: t("objetivos.deadline"), width: "minmax(90px,0.8fr)", placeholder: "—" },
    {
      key: "progress",
      type: "computed",
      header: "%",
      width: "minmax(64px,0.6fr)",
      align: "right",
      compute: (r) => `${r.target > 0 ? Math.round(Math.min(100, (r.current / r.target) * 100)) : 0}%`,
    },
  ];

  const newGoal = (): Goal => ({ id: crypto.randomUUID(), name: "", currency: base, target: 0, current: 0 });

  return (
    <div className="space-y-5 sm:space-y-7">
      {cards.length > 0 ? (
        <>
          {/* Resumo agregado de todas as metas */}
          <Tile className="p-4 sm:p-6 md:p-7">
            <div className="flex flex-wrap items-center gap-x-9 gap-y-4 sm:gap-y-5">
              <ProgressRing pct={view.totalPct} size={104} stroke={9}>
                <span className="text-[clamp(1.1rem,3vw,1.45rem)] font-semibold tabular leading-none">
                  <Hidden>{Math.round(view.totalPct)}%</Hidden>
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <Eyebrow>{t("objetivos.saved")}</Eyebrow>
                <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                  <Money value={view.totalSaved} currency={disp} className="text-[clamp(1.2rem,3vw,1.6rem)] font-semibold tabular" />
                  <span className="text-faint text-[13px]">/ <Money value={view.totalTarget} currency={disp} /></span>
                </div>
              </div>
              {/* Celular: FALTAM/OBJETIVOS numa faixa de 2 colunas, separada por um divisor (organiza
                  o card). Desktop (sm:): volta à linha inline junto do anel + guardado. */}
              <div className="w-full grid grid-cols-2 gap-4 border-t border-border pt-4 sm:w-auto sm:flex sm:items-start sm:gap-x-9 sm:gap-y-4 sm:border-0 sm:pt-0">
                <div>
                  <Eyebrow>{t("objetivos.remaining")}</Eyebrow>
                  <div className="mt-1.5 text-[15px] font-semibold tabular"><Money value={view.totalRemaining} currency={disp} /></div>
                </div>
                <div>
                  <Eyebrow>{t("nav.objetivos")}</Eyebrow>
                  <div className="mt-1.5 text-[15px] font-semibold tabular">{view.doneCount}/{cards.length}</div>
                </div>
              </div>
            </div>
          </Tile>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((g) => (
              <Tile key={g.id} className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium truncate">{g.name}</span>
                  {g.deadline ? <span className="eyebrow shrink-0">{g.deadline}</span> : null}
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-3">
                  <Money value={g.current} currency={disp} className="font-numeric font-semibold tabular text-[18px]" />
                  <span className="text-[12.5px] text-faint tabular">
                    / <Money value={g.target} currency={disp} />
                  </span>
                </div>
                <div className="mt-3 h-[8px] rounded-full bg-card2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="text-muted tabular"><Hidden>{Math.round(g.pct) + "%"}</Hidden></span>
                  {g.done ? (
                    <span className="text-accent font-medium">{t("liberdade.goalReached")}</span>
                  ) : (
                    <span className="text-faint tabular">{t("objetivos.remaining")} <Money value={g.remaining} currency={disp} /></span>
                  )}
                </div>
                {g.arrival && g.arrival !== "done" ? (
                  <div className="mt-1.5 pt-2 border-t border-border text-[11px] text-faint tabular capitalize">
                    {t("liberdade.goalArrival", { date: g.arrival })}
                  </div>
                ) : null}
              </Tile>
            ))}
          </div>
        </>
      ) : null}

      <section>
        <SectionHead title={t("nav.objetivos")} count={data.length} />
        <div className="overflow-x-auto">
          <div className="min-w-0 sm:min-w-[620px]">
            <DataGrid<Goal>
              sortable
              columns={cols}
              rows={data}
              blank={newGoal}
              isComplete={(r) => r.name.trim().length > 0 && r.target > 0}
              onCommit={(r) => void actions.putGoal(r)}
              onDelete={(id) => void actions.removeGoal(id)}
              addPlaceholder={t("objetivos.addGoal")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/** KPIs do cabeçalho do accordion de Objetivos. */
export function ObjetivosSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useObjetivos();
  const v = useMemo(() => {
    if (!data || data.length === 0) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const saved = data.reduce((s, g) => s + conv(g.current, g.currency), 0);
    const avg =
      data.reduce((s, g) => {
        const tt = conv(g.target, g.currency);
        const cc = conv(g.current, g.currency);
        return s + (tt > 0 ? Math.min(100, (cc / tt) * 100) : 0);
      }, 0) / data.length;
    return { count: data.length, saved, avg };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("objetivos.saved")} value={<Money value={v.saved} currency={disp} />} />
      <HeaderKpi secondary label={t("objetivos.avgProgress")} tone="accent" value={`${Math.round(v.avg)}%`} />
      <HeaderKpi secondary label={t("nav.objetivos")} value={<span className="tabular">{v.count}</span>} />
    </HeaderKpis>
  );
}
