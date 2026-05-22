import Link from "next/link";
import { Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { NewGoalButton } from "@/components/goals/new-goal-button";
import { GoalCard } from "@/components/goals/goal-card";
import { listGoals } from "@/services/goals";
import { listAccounts } from "@/services/accounts";
import { getMonthlyHistory } from "@/services/transactions";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { convertOrSame } from "@/lib/financial/currency";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab = "active" } = await searchParams;
  const [goals, accounts, history, displayCurrency, rates] = await Promise.all([
    listGoals({ includeArchived: true }),
    listAccounts(),
    // Aporte médio dos 3 meses anteriores ao mês corrente.
    getMonthlyHistory(3),
    getDisplayCurrency(),
    getRateMap(),
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

  // Particiona as metas
  const isCompleted = (g: { current_amount: number; target_amount: number }) =>
    Number(g.current_amount) >= Number(g.target_amount) && Number(g.target_amount) > 0;
  const activeGoals = goals.filter((g) => !g.is_archived && !isCompleted(g));
  const completedGoals = goals.filter((g) => !g.is_archived && isCompleted(g));
  const archivedGoals = goals.filter((g) => g.is_archived);

  // Resumo — converte cada meta pra moeda de exibição antes de somar,
  // senão metas em moedas diferentes (BRL + EUR) misturam unidades.
  const totalCurrent = activeGoals.reduce(
    (s, g) =>
      s + convertOrSame(Number(g.current_amount), g.currency, displayCurrency, rates),
    0,
  );
  const totalTarget = activeGoals.reduce(
    (s, g) =>
      s + convertOrSame(Number(g.target_amount), g.currency, displayCurrency, rates),
    0,
  );
  const aggregatePct = totalTarget > 0 ? totalCurrent / totalTarget : 0;
  const totalRemaining = Math.max(0, totalTarget - totalCurrent);
  const monthsToFinishAll =
    averageMonthlyAddition > 0 ? Math.ceil(totalRemaining / averageMonthlyAddition) : null;
  // Detecta se há metas em moeda estrangeira pra mostrar hint
  const hasForeignCurrency = activeGoals.some((g) => g.currency !== displayCurrency);

  const showList =
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
        subtitle="Cada meta tem nome, valor e trajetória — a previsão usa o ritmo real de aporte dos 3 meses anteriores."
        actions={<NewGoalButton accounts={accountsLite} />}
      />

      {hasForeignCurrency ? (
        <div className="rounded-[var(--radius)] bg-gold-50 border border-gold-200 dark:bg-gold-700/10 dark:border-gold-700/30 px-5 py-3 mb-5 text-[12.5px]">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-gold-700 dark:text-gold-500 font-medium mr-2">
            Multi-moeda
          </span>
          <span className="text-foreground">
            Você tem metas em moedas diferentes. Os totais abaixo são convertidos
            pra <strong>{displayCurrency}</strong> usando a cotação mais recente.
            Cada meta individualmente mostra seu valor original.
          </span>
        </div>
      ) : null}

      {/* Resumo */}
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
                ? `${(aggregatePct * 100).toFixed(0)}% no agregado`
                : "tudo concluído"
            }
          />
          <KpiCard label="Total acumulado" value={totalCurrent} tone="neutral" />
          <KpiCard
            label="Falta no total"
            value={totalRemaining}
            tone={totalRemaining > 0 ? "negative" : "positive"}
            hint={totalRemaining === 0 ? "todas as metas alcançadas" : undefined}
          />
          <KpiCard
            label="Tempo estimado"
            textValue={
              monthsToFinishAll == null
                ? "—"
                : monthsToFinishAll === 0
                  ? "agora"
                  : monthsToFinishAll < 12
                    ? `≈ ${monthsToFinishAll}m`
                    : `≈ ${(monthsToFinishAll / 12).toFixed(1).replace(".", ",")} anos`
            }
            tone="neutral"
            hint={
              averageMonthlyAddition <= 0
                ? "sem sobra mensal"
                : "no ritmo atual · aporte cheio em todas"
            }
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
          Casa, viagem, reserva de emergência, independência financeira completa — escolha o que faz
          sentido para vocês. O app calcula a trajetória pelo ritmo de aporte real.
        </p>
      </div>
    </Panel>
  );
}
