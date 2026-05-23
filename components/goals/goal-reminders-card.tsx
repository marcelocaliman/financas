"use client";

import { useState } from "react";
import { Bell, Check, Calendar, AlertCircle } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import {
  ContributeDialog,
  type ContributeAccountOption,
  type ContributeDestinationOption,
} from "./contribute-dialog";
import { ReminderDatePill } from "./reminder-date-pill";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { GoalReminder } from "@/services/goal-reminders";

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
  accounts = [],
  linkedAccountsByGoalId = {},
}: {
  reminders: GoalReminder[];
  /** Todas as contas do household — candidatas a origem do aporte */
  accounts?: ContributeAccountOption[];
  /** Mapa goalId → contas vinculadas como fonte (candidatas a destino) */
  linkedAccountsByGoalId?: Record<string, ContributeDestinationOption[]>;
}) {
  const [reminders] = useState(initial);
  const [opening, setOpening] = useState<{
    goalId: string;
    goalName: string;
    goalCurrency: GoalReminder["goalCurrency"];
    defaultAmount?: number;
    defaultDate?: string;
  } | null>(null);

  if (reminders.length === 0) return null;

  const openAportar = (r: GoalReminder) => {
    setOpening({
      goalId: r.goalId,
      goalName: r.goalName,
      goalCurrency: r.goalCurrency,
      defaultAmount: r.expectedAmount ?? undefined,
      defaultDate: r.dueDate,
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
        />

        <ul className="divide-y divide-border -mt-2">
          {reminders.map((r) => (
            <li
              key={r.goalId}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex items-center gap-2.5 flex-1">
                <StatusIcon status={r.status} />
                <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[13.5px] font-medium text-foreground truncate">
                    {r.goalName}
                  </span>
                  <ReminderDatePill reminder={r} />
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
                  onClick={() => openAportar(r)}
                >
                  <Check className="w-3 h-3" strokeWidth={2} />
                  Aportar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {opening ? (
        <ContributeDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setOpening(null);
          }}
          goalId={opening.goalId}
          goalName={opening.goalName}
          goalCurrency={opening.goalCurrency}
          accounts={accounts}
          linkedAccounts={linkedAccountsByGoalId[opening.goalId] ?? []}
          defaultAmount={opening.defaultAmount}
          defaultDate={opening.defaultDate}
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
