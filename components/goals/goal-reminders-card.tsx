"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, Calendar, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { recordGoalContribution } from "@/services/goals.actions";
import { ContributeDialog } from "./contribute-dialog";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { GoalReminder } from "@/services/goal-reminders";
import { cn } from "@/lib/utils/cn";

/**
 * Card de lembretes de aporte — aparece no /dashboard e em /metas.
 * Mostra metas com contribution_day vencido ou próximo (até 30 dias).
 *
 * Cada linha tem 2 ações:
 *   - "Registrar como aportei" (1-click): se a meta tem allocation_value
 *     fixo, registra esse valor com data = today
 *   - "Abrir Aporte…" (mais controle): abre o ContributeDialog
 */
export function GoalRemindersCard({
  reminders: initial,
}: {
  reminders: GoalReminder[];
}) {
  const [reminders, setReminders] = useState(initial);
  const [openingId, setOpeningId] = useState<{
    goalId: string;
    goalName: string;
    goalCurrency: GoalReminder["goalCurrency"];
  } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (reminders.length === 0) return null;

  const acceptDefault = (r: GoalReminder) => {
    if (!r.expectedAmount || r.expectedAmount <= 0) {
      // Sem valor sugerido — abre dialog
      setOpeningId({ goalId: r.goalId, goalName: r.goalName, goalCurrency: r.goalCurrency });
      return;
    }
    setPendingId(r.goalId);
    startTransition(async () => {
      const res = await recordGoalContribution(r.goalId, r.expectedAmount!, {
        source: "manual",
        notes: `Aporte do calendário · ${r.dueDate}`,
        bumpCurrent: true,
      });
      setPendingId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Aporte de ${formatMoney(r.expectedAmount!, r.goalCurrency)} registrado.`);
      setReminders((prev) => prev.filter((x) => x.goalId !== r.goalId));
    });
  };

  return (
    <>
      <Panel className="!p-6">
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Bell className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
              Aportes do mês
            </span>
          }
          meta={`${reminders.length} ${reminders.length === 1 ? "lembrete" : "lembretes"}`}
          action={
            <Link
              href="/metas"
              className="text-navy-700 dark:text-navy-300 text-[12.5px] hover:text-navy-900 dark:hover:text-navy-100"
            >
              Ver metas →
            </Link>
          }
        />

        <ul className="divide-y divide-border -mt-2">
          {reminders.map((r) => (
            <li
              key={r.goalId}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <StatusIcon status={r.status} />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-foreground truncate">
                    {r.goalName}
                  </div>
                  <DatePill reminder={r} />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.expectedAmount != null ? (
                  <span className="font-mono text-[12.5px] text-foreground tabular-nums mr-2">
                    <MoneyMask>{formatMoney(r.expectedAmount, r.goalCurrency)}</MoneyMask>
                  </span>
                ) : null}
                <Button
                  size="sm"
                  variant={r.status === "overdue" ? "primary" : "outline"}
                  disabled={pendingId === r.goalId}
                  onClick={() => acceptDefault(r)}
                >
                  <Check className="w-3 h-3" strokeWidth={2} />
                  {pendingId === r.goalId
                    ? "Registrando…"
                    : r.expectedAmount != null
                      ? "Já aportei"
                      : "Aportar…"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {openingId ? (
        <ContributeDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setOpeningId(null);
          }}
          goalId={openingId.goalId}
          goalName={openingId.goalName}
          goalCurrency={openingId.goalCurrency}
        />
      ) : null}
    </>
  );
}

function StatusIcon({ status }: { status: GoalReminder["status"] }) {
  if (status === "overdue") {
    return <AlertCircle className="w-4 h-4 text-rust-600 shrink-0" strokeWidth={1.8} />;
  }
  if (status === "due_today") {
    return <Calendar className="w-4 h-4 text-gold-700 dark:text-gold-500 shrink-0" strokeWidth={1.8} />;
  }
  return <Calendar className="w-4 h-4 text-navy-700 dark:text-navy-300 shrink-0" strokeWidth={1.8} />;
}

/**
 * Pill destacado com a data do lembrete — info primária pro user.
 * Cor varia pelo status: overdue=rust, due_today=gold, upcoming=navy.
 */
function DatePill({ reminder: r }: { reminder: GoalReminder }) {
  const isOverdue = r.status === "overdue";
  const isDueToday = r.status === "due_today";

  const toneClass = isOverdue
    ? "bg-rust-600/15 text-rust-600 border-rust-600/30"
    : isDueToday
      ? "bg-gold-600/15 text-gold-700 dark:text-gold-500 border-gold-600/30"
      : "bg-navy-700/10 text-navy-700 dark:text-navy-300 border-navy-700/20";

  let label: string;
  if (isOverdue) {
    const ago = Math.abs(r.daysUntil);
    label = `Atrasado há ${ago} ${ago === 1 ? "dia" : "dias"} · era ${formatDate(r.dueDate)}`;
  } else if (isDueToday) {
    label = `Vence hoje · ${formatDate(r.dueDate)}`;
  } else if (r.daysUntil === 1) {
    label = `Vence amanhã · ${formatDate(r.dueDate)}`;
  } else {
    label = `Em ${r.daysUntil} dias · ${formatDate(r.dueDate)}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full border",
        "font-mono text-[11.5px] font-medium tabular-nums tracking-[0.02em]",
        toneClass,
      )}
    >
      <Calendar className="w-3 h-3" strokeWidth={1.8} />
      {label}
    </span>
  );
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Silenciar import implícito do tooling
export { cn };
