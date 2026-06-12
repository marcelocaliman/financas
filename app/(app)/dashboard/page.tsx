import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { QuickAddTrigger } from "@/components/transactions/quick-add-trigger";
import { QuickEntryBar } from "@/components/dashboard/quick-entry-bar";
import { DashboardHero } from "@/components/dashboard/hero";
import { TopCategoriesPanel } from "@/components/dashboard/top-categories";
import { InsightCard } from "@/components/dashboard/insight-card";
import { CoverageStrip } from "@/components/dashboard/coverage-strip";
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
import { getOpenCreditCardBills } from "@/services/credit-card";
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
  monthRange,
} from "@/services/transactions";
import { IrEstimateHero } from "@/components/dashboard/ir-estimate-hero";
import { computeImposto } from "@/services/ir/imposto";
import { isIrEnabled } from "@/services/ir-flag";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/format";
import { formatDateFull, formatTime, getGreeting } from "@/lib/utils/format";
import { monthProgress, projectMonthEnd } from "@/lib/financial/projection";
import { cn } from "@/lib/utils/cn";

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
    irEstimate,
  ] = await Promise.all([
    getMonthlySummary(monthParam),
    getCategoryBreakdown(monthParam, "expense"),
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
    // Estimativa do IRPF do ano corrente (o "momento mágico" do Início).
    // catch → null pra nunca quebrar o dashboard (ex: ano sem tabela cadastrada).
    isCurrent
      ? computeImposto(currentYearForState).catch(() => null)
      : Promise.resolve(null),
  ]);

  // IRPF ligado? Gateia o card-herói de IRPF do Início (reversível).
  const irEnabled = await isIrEnabled();

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

  // Fatura(s) de cartão que VENCEM neste mês e ainda não foram pagas — entram na
  // projeção da sobra (senão o gasto do cartão fica invisível e a sobra infla).
  // Só no mês corrente; faturas pagas (paidAmount) já estão no fluxo de caixa.
  let cardBillDueThisMonth = 0;
  if (isCurrent) {
    const bills = await getOpenCreditCardBills().catch(() => []);
    cardBillDueThisMonth = bills
      .filter(
        (b) =>
          (b.status === "closed_pending" || b.status === "overdue") &&
          b.dueDate.slice(0, 7) === currentMonth,
      )
      .reduce((s, b) => s + Math.max(0, b.totalOpen - b.paidAmount), 0);
  }

  // Forecast em mês futuro
  const effectiveIncome = summary.income + (forecast?.income ?? 0);
  const effectiveExpense = summary.expense + (forecast?.expense ?? 0);
  const projection = projectMonthEnd(
    effectiveIncome,
    effectiveExpense,
    daysElapsed,
    daysInMonth,
    cardBillDueThisMonth,
  );
  // Ritmo de gasto considera a fatura a vencer (coerente com a projeção).
  const projectedOut = effectiveExpense + cardBillDueThisMonth;
  const expenseVsIncome =
    effectiveIncome > 0 ? projectedOut / effectiveIncome : projectedOut > 0 ? 2 : 0;
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

      {/* Lançamento rápido — a ação nº 1 do dia a dia, no topo. Só no mês atual. */}
      {isCurrent ? (
        <div className="mb-5">
          <QuickEntryBar />
        </div>
      ) : null}

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

      {/* Snapshot do mês: IRPF estimado (o ímã) + carteira, lado a lado.
          [&>*]:!mb-0 zera margens internas (o ticker tem mb-6 baked que o deixava
          24px mais curto); [&>*]:h-full faz ambos preencherem a célula. */}
      {isCurrent ? (
        <div className={cn(
          "grid gap-5 mt-5 mb-5 items-stretch [&>*]:!mb-0 [&>*]:h-full",
          irEnabled && "lg:grid-cols-2",
        )}>
          {irEnabled ? (
            <IrEstimateHero imposto={irEstimate} year={currentYearForState} />
          ) : null}
          <PortfolioLiveTicker
            totalMarketBalance={currentValues.totalMarketBalance}
            totalBaseBalance={currentValues.totalBaseBalance}
            displayCurrency={currentValues.displayCurrency}
            variant="compact"
          />
        </div>
      ) : null}

      {/* Próximos 7 dias + Metas em curso — o "o que vem aí" é o mais acionável
          do dia a dia, vem logo após o snapshot. items-start: cada card tem a
          própria altura (Metas com poucas metas não estica deixando buraco). */}
      {isCurrent ? (
        <div className="grid lg:grid-cols-2 gap-5 mb-5 items-start [&>*]:!mb-0">
          <UpcomingObligationsCard upcoming={upcoming!} days={7} />
          <GoalsTopCard goals={goals} monthlySavings={monthlySavings} />
        </div>
      ) : null}

      {/* Cards contextuais — só os que TÊM conteúdo, empacotados em 2 colunas.
          [&>*]:!mb-0 zera as margens internas dos cards pra o gap cuidar do
          espaçamento de forma uniforme. */}
      {isCurrent &&
      (insights.length > 0 ||
        anomalies.length > 0 ||
        apportSuggestions.length > 0 ||
        goalReminders.length > 0 ||
        budgetRows.some((r) => r.status !== "no_budget")) ? (
        <div className="grid lg:grid-cols-2 gap-5 mb-5 items-stretch [&>*]:!mb-0 [&>*]:h-full">
          {insights.length > 0 ? <SmartInsightsCard insights={insights} /> : null}
          {anomalies.length > 0 ? <InsightCard anomalies={anomalies} /> : null}
          {apportSuggestions.length > 0 ? (
            <ApportSuggestionCard suggestions={apportSuggestions} />
          ) : null}
          {goalReminders.length > 0 ? (
            <GoalRemindersCard
              reminders={goalReminders}
              accounts={accountsLite}
              linkedAccountsByGoalId={linkedAccountsByGoalId}
            />
          ) : null}
          {budgetRows.some((r) => r.status !== "no_budget") ? (
            <BudgetStatusCard rows={budgetRows} />
          ) : null}
        </div>
      ) : null}

      {/* Independência financeira (FIRE) — linha compacta, é "plus". A análise
          completa mora em /independencia. */}
      {isCurrent ? (
        <div className="mb-5">
          <CoverageStrip
            coveragePct={coverageRatioDisplay * 100}
            monthlyYield={monthlyYieldDisplay}
          />
        </div>
      ) : null}

      {/* Top categorias + Composição do patrimônio */}
      <div
        className={
          isCurrent
            ? "grid lg:grid-cols-[1.5fr_1fr] gap-5 mb-5 items-stretch [&>*]:!mb-0 [&>*]:h-full"
            : "grid grid-cols-1 mb-5"
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

    </>
  );
}

