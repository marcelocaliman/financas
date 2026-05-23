import Link from "next/link";
import { Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { NewGoalButton } from "@/components/goals/new-goal-button";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalsOverview } from "@/components/goals/goals-overview";
import { MonthlyAllocationPlan } from "@/components/goals/monthly-allocation-plan";
import { GoalRemindersCard } from "@/components/goals/goal-reminders-card";
import { getGoalReminders } from "@/services/goal-reminders";
import {
  computeAllocationPlan,
  listGoalsEnriched,
  type EnrichedGoal,
} from "@/services/goals";
import { listAccounts, getAccountsTotals } from "@/services/accounts";
import { listInvestments, getPortfolioStats } from "@/services/investments";
import { getPhysicalAssetsTotals } from "@/services/physical-assets";
import { getMonthlyHistory } from "@/services/transactions";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { convertOrSame } from "@/lib/financial/currency";
import type { GoalType } from "@/types/database";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab = "active" } = await searchParams;
  const [
    enrichedGoals,
    accounts,
    investments,
    history,
    displayCurrency,
    rates,
    accountsTotals,
    portfolio,
    physical,
    reminders,
  ] = await Promise.all([
    listGoalsEnriched({ includeArchived: true }),
    listAccounts(),
    listInvestments(),
    getMonthlyHistory(3),
    getDisplayCurrency(),
    getRateMap(),
    getAccountsTotals(),
    getPortfolioStats(),
    getPhysicalAssetsTotals(),
    getGoalReminders(30),
  ]);

  const positiveNets = history.map((h) => Math.max(0, h.net));
  const averageMonthlyAddition =
    positiveNets.length > 0
      ? positiveNets.reduce((s, v) => s + v, 0) / positiveNets.length
      : 0;

  const accountsLite = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
  }));
  const investmentsLite = investments.map((i) => ({
    id: i.id,
    ticker: i.ticker,
    name: i.name,
  }));

  const isCompleted = (g: EnrichedGoal) =>
    g.derivedCurrent >= Number(g.target_amount) && Number(g.target_amount) > 0;
  const activeGoals = enrichedGoals.filter((g) => !g.is_archived && !isCompleted(g));
  const completedGoals = enrichedGoals.filter((g) => !g.is_archived && isCompleted(g));
  const archivedGoals = enrichedGoals.filter((g) => g.is_archived);

  // Totais em displayCurrency (multi-currency aware)
  const totalAlocadoDisplay = activeGoals.reduce(
    (s, g) => s + convertOrSame(g.derivedCurrent, g.currency, displayCurrency, rates),
    0,
  );
  const totalTargetDisplay = activeGoals.reduce(
    (s, g) => s + convertOrSame(Number(g.target_amount), g.currency, displayCurrency, rates),
    0,
  );
  const totalFaltaDisplay = Math.max(0, totalTargetDisplay - totalAlocadoDisplay);
  const netWorthDisplay =
    accountsTotals.liquidExcludingInvestmentCash + portfolio.total + physical.total;

  // Plano de aporte mensal (waterfall)
  const allocationPlan = computeAllocationPlan(
    activeGoals,
    averageMonthlyAddition,
    displayCurrency,
    rates,
  );
  const goalIcons = new Map<string, GoalType>(activeGoals.map((g) => [g.id, g.goal_type]));

  const hasForeignCurrency = activeGoals.some((g) => g.currency !== displayCurrency);

  const showList: EnrichedGoal[] =
    tab === "completed" ? completedGoals : tab === "archived" ? archivedGoals : activeGoals;

  return (
    <>
      <PageHeader
        eyebrow={`Objetivos · ritmo de R$${Math.round(averageMonthlyAddition).toLocaleString("pt-BR")}/mês`}
        title={
          <>
            Metas e <em className="not-italic font-display italic text-navy-700">sonhos.</em>
          </>
        }
        subtitle="Vincule fontes reais (contas, investimentos), configure modo de aporte e veja a trajetória de cada uma — sem precisar atualizar nada à mão."
        actions={<NewGoalButton accounts={accountsLite} investments={investmentsLite} />}
      />

      {hasForeignCurrency ? (
        <div className="rounded-[var(--radius)] bg-gold-50 border border-gold-200 dark:bg-gold-700/10 dark:border-gold-700/30 px-5 py-3 mb-5 text-[12.5px]">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-gold-700 dark:text-gold-500 font-medium mr-2">
            Multi-moeda
          </span>
          <span className="text-foreground">
            Os totais abaixo são convertidos pra <strong>{displayCurrency}</strong> usando a
            cotação mais recente. Cada meta individual mostra seu valor original.
          </span>
        </div>
      ) : null}

      {/* TIER 0 — Overview macro */}
      {activeGoals.length > 0 ? (
        <div className="mb-6">
          <GoalsOverview
            activeGoals={activeGoals}
            totalAlocadoDisplay={totalAlocadoDisplay}
            totalFaltaDisplay={totalFaltaDisplay}
            netWorthDisplay={netWorthDisplay}
          />
        </div>
      ) : null}

      {/* Lembretes vencidos / próximos */}
      {reminders.length > 0 ? (
        <div className="mb-7">
          <GoalRemindersCard reminders={reminders} />
        </div>
      ) : null}

      {/* TIER 1 — Plano de aportes (waterfall) */}
      {activeGoals.length > 0 ? (
        <div className="mb-7">
          <MonthlyAllocationPlan
            monthlySavings={averageMonthlyAddition}
            lines={allocationPlan.lines}
            leftover={allocationPlan.leftover}
            goalIcons={goalIcons}
          />
        </div>
      ) : null}

      {/* KPIs simples */}
      {activeGoals.length > 0 || completedGoals.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
          <KpiCard
            label="Metas ativas"
            textValue={
              <span className="inline-flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-navy-700" strokeWidth={1.7} />
                {activeGoals.length}
              </span>
            }
            tone="neutral"
            hint={
              activeGoals.length > 0
                ? `${((totalAlocadoDisplay / Math.max(1, totalTargetDisplay)) * 100).toFixed(0)}% no agregado`
                : "tudo concluído"
            }
          />
          <KpiCard label="Total acumulado" value={totalAlocadoDisplay} tone="neutral" />
          <KpiCard
            label="Falta no total"
            value={totalFaltaDisplay}
            tone={totalFaltaDisplay > 0 ? "negative" : "positive"}
            hint={totalFaltaDisplay === 0 ? "todas alcançadas" : undefined}
          />
          <KpiCard
            label="Concluídas"
            textValue={
              <span className="inline-flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-olive-600" strokeWidth={1.7} />
                {completedGoals.length}
              </span>
            }
            tone={completedGoals.length > 0 ? "positive" : "muted"}
            hint={completedGoals.length === 0 ? "nenhuma ainda" : undefined}
          />
        </div>
      ) : null}

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-surface-muted rounded-[10px] mb-6">
        <TabButton href="/metas" active={tab === "active"} label="Ativas" count={activeGoals.length} />
        <TabButton
          href="/metas?tab=completed"
          active={tab === "completed"}
          label="Concluídas"
          count={completedGoals.length}
          icon={<Trophy className="w-3 h-3" strokeWidth={1.8} />}
        />
        {archivedGoals.length > 0 ? (
          <TabButton
            href="/metas?tab=archived"
            active={tab === "archived"}
            label="Arquivadas"
            count={archivedGoals.length}
          />
        ) : null}
      </div>

      {showList.length === 0 ? (
        <Empty tab={tab} />
      ) : (
        <div className="space-y-4">
          {showList.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              accounts={accountsLite}
              averageMonthlyAddition={averageMonthlyAddition}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TabButton({
  href,
  active,
  label,
  count,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium tracking-[-0.005em] transition-colors " +
        (active
          ? "bg-surface text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      {label}
      <span className="font-mono text-[10.5px] text-faint-foreground">{count}</span>
    </Link>
  );
}

function Empty({ tab }: { tab: string }) {
  if (tab === "completed") {
    return (
      <Panel className="!py-12 text-center">
        <p className="text-[14px] text-muted-foreground">
          Nenhuma meta concluída ainda. A primeira <em className="italic">vitória</em> está chegando.
        </p>
      </Panel>
    );
  }
  if (tab === "archived") {
    return (
      <Panel className="!py-12 text-center">
        <p className="text-[14px] text-muted-foreground">Nenhuma meta arquivada.</p>
      </Panel>
    );
  }
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[460px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Nada definido ainda
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2">
          Toda jornada precisa de um <em className="italic">destino</em>.
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          Defina uma meta, vincule contas ou investimentos como fontes, e configure como recebe
          aporte mensal. O progresso atualiza sozinho — sem precisar editar à mão.
        </p>
      </div>
    </Panel>
  );
}
