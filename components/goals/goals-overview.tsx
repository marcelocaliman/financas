import { Sparkles, Target, Flame, Trophy } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { GOAL_TYPE_ICONS } from "./goal-icons";
import type { EnrichedGoal } from "@/services/goals";

/**
 * Overview no topo da página: visão macro sobre TODAS as metas ativas em
 * uma única passagem:
 *  - Total ainda a alcançar (em displayCurrency, somando todas)
 *  - Total já earmarked
 *  - % do patrimônio total já alocado em metas
 *  - Próximas 3 conquistas (metas mais próximas do 100%)
 */
export function GoalsOverview({
  activeGoals,
  totalAlocadoDisplay,
  totalFaltaDisplay,
  netWorthDisplay,
}: {
  activeGoals: EnrichedGoal[];
  totalAlocadoDisplay: number;
  totalFaltaDisplay: number;
  netWorthDisplay: number;
}) {
  // Clampa em 100%: a mesma conta/investimento pode ser fonte de mais de uma
  // meta, então o total earmarked pode exceder o patrimônio — não faz sentido
  // exibir "120% do patrimônio".
  const sharePctOfNetWorth =
    netWorthDisplay > 0 ? Math.min(1, totalAlocadoDisplay / netWorthDisplay) : 0;

  // Próximas 3 conquistas: metas mais perto de 100%, não concluídas
  const upcoming = activeGoals
    .filter((g) => g.status !== "concluida")
    .map((g) => ({
      goal: g,
      pct: Number(g.target_amount) > 0 ? g.derivedCurrent / Number(g.target_amount) : 0,
      remaining: Math.max(0, Number(g.target_amount) - g.derivedCurrent),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  return (
    <Panel className="!p-7">
      <div className="grid sm:grid-cols-[1fr_1fr_1fr] gap-6">
        <Stat
          icon={<Target className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />}
          label="Earmarked nas metas"
          value={totalAlocadoDisplay}
          hint={
            netWorthDisplay > 0
              ? `${(sharePctOfNetWorth * 100).toFixed(0)}% do patrimônio total`
              : undefined
          }
        />
        <Stat
          icon={<Flame className="w-3.5 h-3.5 text-gold-600" strokeWidth={1.7} />}
          label="Falta atingir"
          value={totalFaltaDisplay}
          hint={`${activeGoals.length} meta${activeGoals.length === 1 ? "" : "s"} ativa${activeGoals.length === 1 ? "" : "s"}`}
        />
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-olive-600" strokeWidth={1.7} />
            Próximas conquistas
          </div>
          {upcoming.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground italic mt-1">
              {activeGoals.some((g) => g.status === "concluida") ? (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-olive-600" strokeWidth={1.7} />
                  Tudo concluído!
                </span>
              ) : (
                "Nenhuma meta ativa"
              )}
            </p>
          ) : (
            <ul className="space-y-1.5 mt-1">
              {upcoming.map((u) => (
                <li key={u.goal.id} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="text-foreground truncate inline-flex items-center gap-1.5">
                    <span aria-hidden>{GOAL_TYPE_ICONS[u.goal.goal_type]}</span>
                    {u.goal.name}
                  </span>
                  <span className="font-mono text-[11.5px] text-faint-foreground shrink-0 tabular-nums">
                    {Math.round(u.pct * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2 flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <Money
        value={value}
        className="text-[22px] tracking-[-0.02em] !items-start text-foreground"
        secondaryClassName="text-[11px] mt-0.5"
        showComparison
      />
      {hint ? (
        <div className="font-mono text-[10.5px] text-muted-foreground mt-2">{hint}</div>
      ) : null}
    </div>
  );
}
