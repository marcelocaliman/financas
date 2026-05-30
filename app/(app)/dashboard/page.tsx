import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { QuickAddTrigger } from "@/components/transactions/quick-add-trigger";
import { DashboardHero } from "@/components/dashboard/hero";
import { TopCategoriesPanel } from "@/components/dashboard/top-categories";
import { LatestTransactionsPanel } from "@/components/dashboard/latest-transactions";
import { InsightCard } from "@/components/dashboard/insight-card";
import { FireCard } from "@/components/dashboard/fire-card";
import { GoalsTopCard } from "@/components/dashboard/goals-top-card";
import { UpcomingObligationsCard } from "@/components/dashboard/upcoming-obligations-card";
import { ApportSuggestionCard } from "@/components/dashboard/apport-suggestion-card";
import {
  PatrimonioComposition,
  type CompositionBucket,
} from "@/components/dashboard/patrimonio-composition";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { PortfolioLiveTicker } from "@/components/investments/portfolio-live-ticker";
import { getCurrentUserContext } from "@/services/auth";
import { getAccountsTotals, getAccountsTotalsAt, listAccounts } from "@/services/accounts";
import { getCoverage, getPortfolioStats } from "@/services/investments";
import { getCurrentValueMap } from "@/services/quotes";
import { getPhysicalAssetsTotals } from "@/services/physical-assets";
import { getPortfolioState } from "@/services/portfolio-state";
import { getRecurrencesForecast } from "@/services/recurrences";
import { listGoalsEnriched } from "@/services/goals";
import { getAportSuggestions } from "@/services/goal-suggestions";
import { getGoalReminders } from "@/services/goal-reminders";
import { GoalRemindersCard } from "@/components/goals/goal-reminders-card";
import { getBudgetVsActual } from "@/services/budgets";
import { BudgetStatusCard } from "@/components/budgets/budget-status-card";
import { getInsights } from "@/services/insights";
import { SmartInsightsCard } from "@/components/dashboard/smart-insights-card";
import { getSetupStatus } from "@/services/setup-status";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { CreditCardBillShortcut } from "@/components/dashboard/credit-card-bill-shortcut";
import { getUpcomingObligations } from "@/services/upcoming";
import { getPatrimonioHistory, getSobraHistory } from "@/services/patrimonio-history";
import {
  detectExpenseAnomalies,
  getCategoryBreakdown,
  getCategorySpendHistory,
  getMonthlyHistory,
  getMonthlySummary,
  listTransactions,
  monthRange,
} from "@/services/transactions";
import { IncomeVsExpenseChart } from "@/components/dashboard/income-vs-expense-chart";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { formatDateFull, formatTime, getGreeting } from "@/lib/utils/format";
import { monthProgress, projectMonthEnd } from "@/lib/financial/projection";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const params = await searchParams;
  const monthParam = params.month; // YYYY-MM ou undefined

  const firstName = ctx.profile.display_name.split(" ")[0];
  const now = new Date();
  const greeting = getGreeting(now);

  const { daysElapsed, daysInMonth, ratio, position } = monthProgress(monthParam, now);
  const isCurrent = position === "current";
  const { label: monthLabel, from, to } = monthRange(monthParam);
  const currentMonth = from.slice(0, 7);

  const currentYearForState = new Date().getFullYear();
  const [
    summary,
    breakdown,
    latest,
    totals,
    anomalies,
    portfolio,
    coverage,
    currentValues,
    physical,
    portfolioState,
    forecast,
    goals,
    upcoming,
    patrimonioHistory,
    sobraHistory,
    history6,
    apportSuggestions,
    goalReminders,
    budgetRows,
    insights,
    accounts,
    categorySpendHistory,
    setupStatus,
  ] = await Promise.all([
    getMonthlySummary(monthParam),
    getCategoryBreakdown(monthParam, "expense"),
    listTransactions({ month: monthParam, pageSize: 30 }),
    isCurrent ? getAccountsTotals() : getAccountsTotalsAt(to),
    isCurrent ? detectExpenseAnomalies() : Promise.resolve([]),
    getPortfolioStats(),
    getCoverage(),
    getCurrentValueMap(),
    getPhysicalAssetsTotals(),
    getPortfolioState(currentYearForState),
    position === "future" ? getRecurrencesForecast(currentMonth) : null,
    isCurrent ? listGoalsEnriched() : Promise.resolve([]),
    isCurrent ? getUpcomingObligations(7) : Promise.resolve(null),
    isCurrent ? getPatrimonioHistory(12) : Promise.resolve([]),
    isCurrent ? getSobraHistory(6) : Promise.resolve([]),
    // Histórico de 6 meses pra calcular sobra média (usada no FIRE / metas ETA)
    isCurrent ? getMonthlyHistory(6) : Promise.resolve([]),
    isCurrent ? getAportSuggestions() : Promise.resolve([]),
    isCurrent ? getGoalReminders(30) : Promise.resolve([]),
    isCurrent ? getBudgetVsActual() : Promise.resolve([]),
    isCurrent ? getInsights() : Promise.resolve([]),
    listAccounts(),
    isCurrent
      ? getCategorySpendHistory(6)
      : Promise.resolve(new Map<string, number[]>()),
    isCurrent ? getSetupStatus() : Promise.resolve(null),
  ]);

  // ---- Onboarding banner gating (cheap: 2 queries só quando is current) ----
  let showOnboardingBanner = false;
  if (isCurrent) {
    const supabase = await createClient();
    const [{ data: hh }, { count: txCount }] = await Promise.all([
      supabase
        .from("households")
        .select("onboarding_completed_at")
        .eq("id", ctx.household.id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .limit(1),
    ]);
    showOnboardingBanner =
      !hh?.onboarding_completed_at && (txCount ?? 0) === 0;
  }

  // Patrimônio líquido — fonte única em portfolio-state.totalsNet
  // (exclui caixa de corretora e cartão como passivo, equivalente à fórmula
  // antiga `liquidExcludingInvestmentCash + portfolio.total + physical.total`)
  const netWorth = portfolioState.totalsNet.today;

  // Pra o GoalRemindersCard abrir o ContributeDialog completo (com origem
  // + destino), passamos a lista de contas + mapa goalId → contas vinculadas.
  const accountsLite = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
  }));
  const linkedAccountsByGoalId: Record<
    string,
    Array<{ accountId: string; label: string }>
  > = {};
  for (const g of goals) {
    const linked = g.sourcesResolved
      .filter((r) => r.source.source_type === "account" && r.source.source_id)
      .map((r) => ({
        accountId: r.source.source_id as string,
        label: `${r.label} (fonte vinculada)`,
      }));
    if (linked.length > 0) linkedAccountsByGoalId[g.id] = linked;
  }

  // Forecast em mês futuro
  const effectiveIncome = summary.income + (forecast?.income ?? 0);
  const effectiveExpense = summary.expense + (forecast?.expense ?? 0);
  const projection = projectMonthEnd(effectiveIncome, effectiveExpense, daysElapsed, daysInMonth);
  const expenseVsIncome =
    effectiveIncome > 0 ? effectiveExpense / effectiveIncome : effectiveExpense > 0 ? 2 : 0;
  const isForecastMode = forecast != null && forecast.count > 0;

  // Sobra média mensal (últimos 6 meses) — usada em FIRE ETA, metas ETA, etc.
  const monthlySavings =
    history6.length > 0
      ? history6.reduce((s, r) => s + Math.max(0, r.net), 0) / history6.length
      : Math.max(0, summary.income - summary.expense);

  // Sparklines (somente mês corrente — meses não-correntes não fazem sentido aqui)
  const patrimonioSpark = isCurrent ? patrimonioHistory.map((p) => p.netWorth) : [];
  const sobraSpark = isCurrent ? sobraHistory.map((s) => s.net) : [];
  // Patrimônio do mês anterior pra Δ% — penúltimo ponto da série
  const patrimonioPrev =
    isCurrent && patrimonioHistory.length >= 2
      ? patrimonioHistory[patrimonioHistory.length - 2].netWorth
      : null;

  // Cobertura: usa yield mensal médio real cadastrado (investment_yields).
  // Sem fallback de live compound — se não tem yield cadastrado, mostra 0.
  const monthlyYieldDisplay = coverage.monthlyAverageYield;
  const coverageRatioDisplay =
    coverage.monthlyAverageExpense > 0
      ? monthlyYieldDisplay / coverage.monthlyAverageExpense
      : 0;

  // Composição do patrimônio — buckets por classe de ativo
  const liquidAccounts = totals.byType.checking + totals.byType.savings + totals.byType.cash;
  const cardDebt = Math.abs(totals.byType.credit_card);
  const compositionBuckets: CompositionBucket[] = [
    {
      key: "liquid",
      label: "Líquido",
      value: liquidAccounts,
      tone: "navy",
      hint: "contas correntes + poupança + dinheiro",
    },
    {
      key: "fixed-income",
      label: "Renda fixa",
      value: currentValues.byClass.fixedIncome.balance,
      tone: "olive",
      hint: "Tesouro, CDB, LCI, LCA",
    },
    {
      key: "variable",
      label: "Renda variável",
      value:
        currentValues.byClass.fiis.balance +
        currentValues.byClass.stocks.balance +
        currentValues.byClass.other.balance,
      tone: "gold",
      hint: "FIIs, ações, cripto",
    },
    {
      key: "physical",
      label: "Bens físicos",
      value: physical.total,
      tone: "ink",
      hint: "imóveis, veículos, valor de uso",
    },
  ];
  // Se houver dívida de cartão, adiciona como passivo (tone rust)
  if (cardDebt > 0.5) {
    compositionBuckets.push({
      key: "credit-card",
      label: "Cartão de crédito (passivo)",
      value: cardDebt,
      tone: "rust",
      hint: "fatura em aberto",
    });
  }
  const compositionTotal =
    liquidAccounts +
    currentValues.byClass.fixedIncome.balance +
    currentValues.byClass.fiis.balance +
    currentValues.byClass.stocks.balance +
    currentValues.byClass.other.balance +
    physical.total;

  const subtitle = isCurrent
    ? "O pulso do mês — sobra projetada, ritmo de gasto e o respiro do patrimônio."
    : position === "past"
      ? "Retrospectiva — receitas, despesas e o que sobrou."
      : isForecastMode
        ? `Previsão — ${forecast.count} lançamento${forecast.count === 1 ? "" : "s"} estimado${forecast.count === 1 ? "" : "s"} a partir das recorrências ativas.`
        : "Mês futuro — sem regras recorrentes ativas. Cadastre em /recorrentes pra ver previsões.";

  return (
    <>
      <PageHeader
        eyebrow={isCurrent ? `${formatDateFull(now)} · ${formatTime(now)}` : "Visão de mês"}
        title={
          <>
            {greeting},{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">{firstName}.</em>
          </>
        }
        subtitle={subtitle}
        actions={
          <>
            <MonthSwitcher
              currentMonth={currentMonth}
              isCurrent={isCurrent}
              label={monthLabel.split(" ")[0]}
            />
            {isCurrent ? <CreditCardBillShortcut accounts={accountsLite} /> : null}
            <QuickAddTrigger />
          </>
        }
      />

      {showOnboardingBanner ? <WelcomeBanner firstName={firstName} /> : null}
      {!showOnboardingBanner && setupStatus ? <SetupBanner status={setupStatus} /> : null}

      <DashboardHero
        projectedNet={projection.projectedNet}
        monthLabel={monthLabel}
        netConfidence={projection.confidence}
        income={effectiveIncome}
        expense={effectiveExpense}
        patrimonio={netWorth}
        monthRatio={ratio}
        expenseRatio={expenseVsIncome}
        isCurrentMonth={isCurrent}
        isForecast={isForecastMode}
        patrimonioPrevious={patrimonioPrev}
        patrimonioSparkline={patrimonioSpark}
        sobraSparkline={sobraSpark}
      />

      {/* Ticker do portfolio (totais agregados, sem animação live) */}
      {isCurrent ? (
        <PortfolioLiveTicker
          totalMarketBalance={currentValues.totalMarketBalance}
          totalBaseBalance={currentValues.totalBaseBalance}
          displayCurrency={currentValues.displayCurrency}
          variant="compact"
        />
      ) : null}

      {/* Insight de anomalias (somente mês corrente) */}
      {isCurrent && insights.length > 0 ? <SmartInsightsCard insights={insights} /> : null}

      {isCurrent ? <InsightCard anomalies={anomalies} /> : null}

      {isCurrent && apportSuggestions.length > 0 ? (
        <ApportSuggestionCard suggestions={apportSuggestions} />
      ) : null}

      {isCurrent && goalReminders.length > 0 ? (
        <div className="mb-6">
          <GoalRemindersCard
            reminders={goalReminders}
            accounts={accountsLite}
            linkedAccountsByGoalId={linkedAccountsByGoalId}
          />
        </div>
      ) : null}

      {isCurrent && budgetRows.some((r) => r.status !== "no_budget") ? (
        <div className="mb-6">
          <BudgetStatusCard rows={budgetRows} />
        </div>
      ) : null}

      {/* TIER 1 — Obrigações dos próximos 7 dias + Metas em curso.
          O que vence/cai essa semana é mais acionável no dia a dia que a
          projeção de FIRE (que vem logo abaixo). */}
      {isCurrent ? (
        <div className="grid lg:grid-cols-2 gap-5 mb-8">
          <UpcomingObligationsCard upcoming={upcoming!} days={7} />
          <GoalsTopCard goals={goals} monthlySavings={monthlySavings} />
        </div>
      ) : null}

      {/* TIER 2 — IF + Cobertura (visão de longo prazo pra FIRE) */}
      {isCurrent ? (
        <div className="grid lg:grid-cols-2 gap-5 mb-8">
          <FireCard
            monthlyPassiveIncome={coverage.monthlyAverageYield}
            monthlyExpense={
              coverage.monthlyAverageExpense > 0
                ? coverage.monthlyAverageExpense
                : effectiveExpense
            }
            netWorth={netWorth}
            monthlySavings={monthlySavings}
          />
          <CoveragePanel
            monthlyYield={monthlyYieldDisplay}
            monthlyExpense={coverage.monthlyAverageExpense}
            ratio={coverageRatioDisplay}
            hasInvestments={portfolio.total > 0}
          />
        </div>
      ) : null}

      {/* TIER 2.5 — Tendência receitas vs despesas (somente mês corrente) */}
      {isCurrent && history6.length >= 2 ? (
        <div className="mb-8">
          <IncomeVsExpenseChart data={history6} />
        </div>
      ) : null}

      {/* TIER 3 — Top categorias + Composição do patrimônio */}
      <div
        className={
          isCurrent ? "grid lg:grid-cols-[1.5fr_1fr] gap-5 mb-8" : "grid grid-cols-1 mb-8"
        }
      >
        <TopCategoriesPanel
          rows={isForecastMode && breakdown.length === 0 ? forecast.expenseByCategory : breakdown}
          monthLabel={monthLabel}
          isForecast={isForecastMode && breakdown.length === 0}
          spendHistory={isCurrent ? categorySpendHistory : undefined}
        />
        {isCurrent ? (
          <PatrimonioComposition
            buckets={compositionBuckets}
            total={compositionTotal}
          />
        ) : null}
      </div>

      {/* TIER 4 — Últimos movimentos (10 por página + busca client-side) */}
      <LatestTransactionsPanel
        rows={latest.rows}
        forecastRows={isForecastMode ? forecast.occurrences : []}
        isForecast={isForecastMode && latest.rows.length === 0}
      />
    </>
  );
}

function CoveragePanel({
  monthlyYield,
  monthlyExpense,
  ratio,
  hasInvestments,
}: {
  monthlyYield: number;
  monthlyExpense: number;
  ratio: number;
  hasInvestments: boolean;
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
        <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-navy-700 dark:text-navy-300 mb-2.5 font-medium">
          Renda do patrimônio
        </div>
        <div className="font-mono text-[28px] tracking-[-0.025em] text-foreground leading-none">
          {formatMoney(monthlyYield)}
          <span className="text-[14px] text-muted-foreground ml-1.5">/mês</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground mt-1.5">
          {!hasInvestments
            ? "ainda sem ativos cadastrados"
            : "média líquida · últimos 3 meses"}
        </p>

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
