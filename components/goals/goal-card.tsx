"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { archiveGoal, deleteGoal } from "@/services/goals.actions";
import type { Goal } from "@/services/goals";
import { estimateCompletion } from "@/lib/financial/projection";
import { formatMoney } from "@/lib/utils/format";
import { GoalSheet } from "./goal-sheet";

export function GoalCard({
  goal,
  accounts,
  averageMonthlyAddition,
}: {
  goal: Goal;
  accounts: { id: string; name: string; institution: string }[];
  averageMonthlyAddition: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleArchive = () => {
    if (!confirm(`Arquivar meta "${goal.name}"?`)) return;
    startTransition(async () => {
      const r = await archiveGoal(goal.id);
      if (r.error) toast.error(r.error);
      else toast.success("Meta arquivada.");
    });
  };
  const handleDelete = () => {
    if (!confirm(`Excluir meta "${goal.name}" DEFINITIVAMENTE?`)) return;
    startTransition(async () => {
      const r = await deleteGoal(goal.id);
      if (r.error) toast.error(r.error);
      else toast.success("Meta excluída.");
    });
  };

  const current = Number(goal.current_amount);
  const target = Number(goal.target_amount);
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const eta = estimateCompletion(current, target, averageMonthlyAddition);
  const targetMonthLabel = goal.target_date
    ? new Date(goal.target_date).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      })
    : null;
  const etaMonthLabel = eta.etaDate
    ? new Date(eta.etaDate).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[var(--radius-lg)] border border-border bg-surface px-8 py-7 grid sm:grid-cols-[1fr_220px] gap-8 hover:shadow-sm transition-shadow group"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            {pct >= 1 ? <Badge tone="olive" dot>Concluída</Badge> : null}
          </div>
          <h3 className="font-display text-[24px] tracking-[-0.02em] font-medium text-foreground">
            {goal.name}
          </h3>
          {goal.description ? (
            <p className="text-[13.5px] text-muted-foreground mt-1.5">{goal.description}</p>
          ) : null}

          <div className="mt-6">
            <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-navy-800 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${pct * 100}%` }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="flex justify-between mt-2 font-mono text-[12.5px]">
              <span className="font-medium text-foreground">
                {formatMoney(current)}{" "}
                <span className="text-faint-foreground">
                  · {Math.round(pct * 100)}%
                </span>
              </span>
              <span className="text-muted-foreground">{formatMoney(target)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between text-right gap-3 border-l border-border pl-7 -ml-1">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground mb-1 font-medium">
              Previsão
            </div>
            <div className="font-mono text-[18px] font-medium text-navy-900">
              {eta.months === 0
                ? "Pronto"
                : eta.months === null
                  ? "—"
                  : etaMonthLabel ?? `${eta.months} meses`}
            </div>
            <div className="font-mono text-[11.5px] text-muted-foreground mt-0.5">
              {eta.months === null
                ? "sem aportes recentes"
                : eta.months === 0
                  ? "meta atingida"
                  : `aporte médio ${formatMoney(averageMonthlyAddition)}/mês`}
            </div>
            {targetMonthLabel ? (
              <div className="font-mono text-[10.5px] text-faint-foreground mt-1.5">
                meta original: {targetMonthLabel}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Editar">
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={pending}
              onClick={handleArchive}
              aria-label="Arquivar"
              className="text-rust-600"
            >
              <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={pending}
              onClick={handleDelete}
              aria-label="Excluir definitivamente"
              className="text-rust-600"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
            </Button>
          </div>
        </div>
      </motion.div>
      <GoalSheet open={editing} onOpenChange={setEditing} goal={goal} accounts={accounts} />
    </>
  );
}
