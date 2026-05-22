import Link from "next/link";
import { Target } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { estimateCompletion } from "@/lib/financial/projection";
import type { Goal } from "@/services/goals";
import { cn } from "@/lib/utils/cn";

/**
 * Top 3 metas ativas — barra de progresso, valor restante, ETA estimada.
 *
 * O ETA usa `estimateCompletion(current, target, monthlySavings)` — assume que
 * a sobra média mensal do casal vai inteira pra meta (otimista, mas dá uma
 * referência). Quando não há sobra, mostra "—".
 */
export function GoalsTopCard({
  goals,
  monthlySavings,
}: {
  goals: Goal[];
  /** Sobra média mensal usada como aporte hipotético */
  monthlySavings: number;
}) {
  const top = goals.slice(0, 3);

  return (
    <Panel className="!p-0 overflow-hidden">
      <div className="px-7 pt-6 pb-3 border-b border-border">
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Target className="w-4 h-4 text-navy-700" strokeWidth={1.7} />
              Metas em curso
            </span>
          }
          meta={
            goals.length === 0
              ? "ainda sem metas"
              : `${goals.length} meta${goals.length === 1 ? "" : "s"} ativa${goals.length === 1 ? "" : "s"}`
          }
          action={
            <Link
              href="/metas"
              className="text-navy-700 text-[12.5px] hover:text-navy-900"
            >
              Ver todas →
            </Link>
          }
          className="!mb-0"
        />
      </div>

      {top.length === 0 ? (
        <div className="px-7 py-8 text-center">
          <p className="text-[13px] text-muted-foreground italic">
            Sem metas cadastradas. Defina objetivos pra acompanhar progresso.
          </p>
          <Link
            href="/metas"
            className="inline-block mt-2 text-[12.5px] text-navy-700 hover:text-navy-900 font-medium"
          >
            Criar primeira meta →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {top.map((g) => (
            <GoalRow key={g.id} goal={g} monthlySavings={monthlySavings} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function GoalRow({
  goal,
  monthlySavings,
}: {
  goal: Goal;
  monthlySavings: number;
}) {
  const current = Number(goal.current_amount ?? 0);
  const target = Number(goal.target_amount ?? 0);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const remaining = Math.max(0, target - current);
  const isAchieved = current >= target && target > 0;

  // ETA — divide a sobra mensal pela quantidade de metas pendentes seria mais
  // honesto, mas como mostramos só 3 e a sobra média é "uma única bolsa",
  // damos o ETA otimista (assume aporte total). Usuário lê com sal.
  const { months } = estimateCompletion(current, target, monthlySavings);

  return (
    <li className="px-7 py-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-foreground truncate">{goal.name}</div>
          {goal.target_date ? (
            <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.05em] mt-0.5">
              alvo · {formatTargetDate(goal.target_date)}
            </div>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <div
            className={cn(
              "font-mono text-[13px] tabular-nums",
              isAchieved ? "text-olive-700 dark:text-olive-500" : "text-foreground",
            )}
          >
            <Money
              value={current}
              className="inline-flex !flex-row !items-baseline text-[13px]"
            />
            <span className="text-faint-foreground"> / </span>
            <Money
              value={target}
              className="inline-flex !flex-row !items-baseline text-[12.5px] text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-[5px] bg-bone-100 dark:bg-ink-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              isAchieved ? "bg-olive-600" : "bg-navy-700",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground shrink-0 w-10 text-right tabular-nums">
          {pct}%
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1.5">
        {isAchieved ? (
          <span className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-olive-700 dark:text-olive-500">
            ✓ concluída
          </span>
        ) : (
          <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em]">
            faltam{" "}
            <Money
              value={remaining}
              className="inline-flex !flex-row !items-baseline text-[10.5px] text-muted-foreground"
            />
          </span>
        )}
        {!isAchieved && months != null ? (
          <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em]">
            {months === 0
              ? "agora"
              : months < 12
                ? `≈ ${months} ${months === 1 ? "mês" : "meses"}`
                : `≈ ${(months / 12).toFixed(1).replace(".", ",")} anos`}
          </span>
        ) : !isAchieved && monthlySavings <= 0 ? (
          <span className="font-mono text-[10.5px] text-faint-foreground italic">
            sem sobra mensal
          </span>
        ) : null}
      </div>
    </li>
  );
}

function formatTargetDate(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${labels[m - 1]}/${String(y).slice(2)}`;
}
