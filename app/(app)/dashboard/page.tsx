import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { QuickAddTrigger } from "@/components/transactions/quick-add-trigger";
import { CoverageLiveAccrued } from "@/components/dashboard/coverage-live-accrued";
import { DashboardHero } from "@/components/dashboard/hero";
import { TopCategoriesPanel } from "@/components/dashboard/top-categories";
import { LatestTransactionsPanel } from "@/components/dashboard/latest-transactions";
import { InsightCard } from "@/components/dashboard/insight-card";
import { PortfolioLiveTicker } from "@/components/investments/portfolio-live-ticker";
import { getCurrentUserContext } from "@/services/auth";
import { getAccountsTotals } from "@/services/accounts";
import { getCoverage, getPortfolioStats } from "@/services/investments";
import { getLivePortfolio } from "@/services/live-yield";
import { getPhysicalAssetsTotals } from "@/services/physical-assets";
import {
  detectExpenseAnomalies,
  getCategoryBreakdown,
  getMonthlySummary,
  listTransactions,
  monthRange,
} from "@/services/transactions";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { formatDateFull, formatTime, getGreeting } from "@/lib/utils/format";
import { monthProgress, projectMonthEnd } from "@/lib/financial/projection";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const firstName = ctx.profile.display_name.split(" ")[0];
  const now = new Date();
  const greeting = getGreeting(now);

  const [summary, breakdown, latest, totals, anomalies, portfolio, coverage, live, physical] =
    await Promise.all([
      getMonthlySummary(),
      getCategoryBreakdown(undefined, "expense"),
      listTransactions({ pageSize: 6 }),
      getAccountsTotals(),
      detectExpenseAnomalies(),
      getPortfolioStats(),
      getCoverage(),
      getLivePortfolio(),
      getPhysicalAssetsTotals(),
    ]);

  // Patrimônio total SEM dupla contagem:
  //   contas líquidas (excluindo caixa de corretora) + investimentos + bens físicos
  const netWorth =
    totals.liquidExcludingInvestmentCash + portfolio.total + physical.total;

  const { label: monthLabel } = monthRange();
  const { daysElapsed, daysInMonth, ratio } = monthProgress(now);
  const projection = projectMonthEnd(summary.income, summary.expense, daysElapsed, daysInMonth);
  const expenseVsIncome =
    summary.income > 0 ? summary.expense / summary.income : summary.expense > 0 ? 2 : 0;

  return (
    <>
      <PageHeader
        eyebrow={`${formatDateFull(now)} · ${formatTime(now)}`}
        title={
          <>
            {greeting},{" "}
            <em className="not-italic font-display italic text-navy-700">{firstName}.</em>
          </>
        }
        subtitle="O pulso do mês — sobra projetada, ritmo de gasto e o respiro do patrimônio."
        actions={
          <>
            <Button variant="secondary" disabled>
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.7} />
              {monthLabel.split(" ")[0]}
            </Button>
            <QuickAddTrigger />
          </>
        }
      />

      <DashboardHero
        projectedNet={projection.projectedNet}
        monthLabel={monthLabel}
        netConfidence={projection.confidence}
        income={summary.income}
        expense={summary.expense}
        patrimonio={netWorth}
        monthRatio={ratio}
        expenseRatio={expenseVsIncome}
        liveDailyYield={live.totalDailyYield}
        livePerSecond={live.totalPerSecond}
      />

      <PortfolioLiveTicker portfolio={live} variant="compact" />

      <InsightCard anomalies={anomalies} />

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 mb-8">
        <TopCategoriesPanel rows={breakdown} monthLabel={monthLabel} />
        <CoveragePanel
          monthlyYield={coverage.monthlyAverageYield}
          monthlyExpense={coverage.monthlyAverageExpense}
          ratio={coverage.ratio}
          hasInvestments={portfolio.total > 0}
          liveDailyYield={live.totalDailyYield}
          livePerSecond={live.totalPerSecond}
        />
      </div>

      <LatestTransactionsPanel rows={latest.rows} />
    </>
  );
}

function CoveragePanel({
  monthlyYield,
  monthlyExpense,
  ratio,
  hasInvestments,
  liveDailyYield = 0,
  livePerSecond = 0,
}: {
  monthlyYield: number;
  monthlyExpense: number;
  ratio: number;
  hasInvestments: boolean;
  liveDailyYield?: number;
  livePerSecond?: number;
}) {
  const pct = Math.min(100, Math.round(ratio * 100));
  return (
    <Panel className="!p-7 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 w-40 h-40"
        style={{ background: "radial-gradient(circle, rgba(176,123,50,0.07), transparent 70%)" }}
      />
      <div className="relative z-10">
        <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-navy-700 mb-2.5 font-medium">
          Renda do patrimônio
        </div>
        <div className="font-mono text-[28px] tracking-[-0.025em] text-foreground leading-none">
          {formatMoney(monthlyYield)}
          <span className="text-[14px] text-muted-foreground ml-1.5">/mês</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground mt-1.5">
          {hasInvestments
            ? "média líquida · últimos 3 meses"
            : "ainda sem ativos cadastrados"}
        </p>

        {liveDailyYield > 0 ? (
          <CoverageLiveAccrued dailyYield={liveDailyYield} perSecond={livePerSecond} />
        ) : null}

        <div className="mt-6 flex items-center gap-4">
          <div className="relative w-[86px] h-[86px] shrink-0">
            <svg width="86" height="86" viewBox="0 0 86 86" className="-rotate-90">
              <circle cx="43" cy="43" r="37" fill="none" stroke="var(--color-navy-100)" strokeWidth="5" />
              <circle
                cx="43"
                cy="43"
                r="37"
                fill="none"
                stroke="var(--color-navy-800)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 37}
                strokeDashoffset={2 * Math.PI * 37 * (1 - pct / 100)}
                className="transition-[stroke-dashoffset] duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
              <span className="text-[19px] font-medium text-foreground">{pct}%</span>
              <span className="text-[9px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
                cobertura
              </span>
            </div>
          </div>
          <div className="text-[12.5px] text-muted-foreground leading-[1.55]">
            <p className="font-medium text-foreground text-[13.5px] mb-1">
              {pct}% das despesas fixas cobertas
            </p>
            <p>
              Despesa média {formatMoney(monthlyExpense)}/mês. Cobertura{" "}
              {ratio > 0 ? formatPercent(ratio, 0) : "—"}
              {ratio > 0 && ratio < 1
                ? `. Falta ${formatMoney(monthlyExpense - monthlyYield)}.`
                : ratio >= 1
                  ? ". Já dá pra viver da renda."
                  : ""}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
