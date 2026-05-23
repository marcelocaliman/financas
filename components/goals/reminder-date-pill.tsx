import { Calendar } from "lucide-react";
import type { GoalReminder } from "@/services/goal-reminders";
import { cn } from "@/lib/utils/cn";

/**
 * Pill colorido com a data do lembrete de aporte.
 * Cor varia pelo status:
 *   - overdue → rust (vermelho urgente)
 *   - due_today → gold (atenção)
 *   - upcoming → navy (informativo)
 *
 * Usado tanto no GoalRemindersCard (no dashboard) quanto inline no GoalCard
 * (no /metas) pra dar contexto temporal direto onde a meta vive.
 */
export function ReminderDatePill({ reminder: r }: { reminder: GoalReminder }) {
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
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shrink-0",
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
