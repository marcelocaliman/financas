import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { NewGoalButton } from "@/components/goals/new-goal-button";
import { GoalCard } from "@/components/goals/goal-card";
import { listGoals } from "@/services/goals";
import { listAccounts } from "@/services/accounts";
import { getMonthlyHistory } from "@/services/transactions";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const [goals, accounts, history] = await Promise.all([
    listGoals(),
    listAccounts(),
    getMonthlyHistory(3),
  ]);

  // Aporte médio = média das sobras dos últimos 3 meses (positivas).
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

  const active = goals.filter((g) => !g.is_archived);

  return (
    <>
      <PageHeader
        eyebrow={`Objetivos · ${active.length} meta${active.length !== 1 ? "s" : ""} ativa${active.length !== 1 ? "s" : ""}`}
        title={
          <>
            Metas e <em className="not-italic font-display italic text-navy-700">sonhos.</em>
          </>
        }
        subtitle="Cada meta tem nome, valor e trajetória — a previsão de conclusão vem do ritmo real de aporte dos últimos 3 meses."
        actions={<NewGoalButton accounts={accountsLite} />}
      />

      {active.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-4">
          {active.map((g) => (
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

function Empty() {
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
