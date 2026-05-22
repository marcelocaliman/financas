"use client";

import { useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Calendar, Pause, Pencil, Play, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Money } from "@/components/ui/money";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { formatDateShort } from "@/lib/utils/format";
import {
  deleteRecurringRule,
  materializeRecurrenceNow,
  setRecurringRuleActive,
} from "@/services/recurrences.actions";
import type { Currency, RecurrenceFrequency, Tables } from "@/types/database";
import { RecurrenceSheet } from "./recurrence-sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };
type Rule = Tables<"recurring_rules"> & {
  account?: { id: string; name: string; institution: string } | null;
  from_account?: { id: string; name: string; institution: string } | null;
  to_account?: { id: string; name: string; institution: string } | null;
  category?: { id: string; name: string; color: string | null; icon: string | null } | null;
};

const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function describeFrequencyShort(rule: Rule): string {
  const each = rule.interval_count > 1 ? `${rule.interval_count}` : "";
  const freqMap: Record<RecurrenceFrequency, string> = {
    daily: rule.interval_count > 1 ? `${each} dias` : "diária",
    weekly:
      rule.day_of_week != null
        ? WEEKDAYS_SHORT[rule.day_of_week]
        : rule.interval_count > 1
          ? `${each} sem`
          : "semanal",
    monthly:
      rule.day_of_month != null
        ? `dia ${rule.day_of_month}`
        : rule.interval_count > 1
          ? `${each} meses`
          : "mensal",
    yearly: rule.interval_count > 1 ? `${each} anos` : "anual",
  };
  return freqMap[rule.frequency];
}

export function RecurrenceRow({
  rule,
  nextOccurrences,
  accounts,
  categories,
}: {
  rule: Rule;
  nextOccurrences: string[];
  accounts: AccountLite[];
  categories: CategoryLite[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const kindIcon =
    rule.kind === "income" ? (
      <ArrowDownLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
    ) : rule.kind === "expense" ? (
      <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.8} />
    ) : (
      <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.8} />
    );

  const kindColor =
    rule.kind === "income"
      ? "text-olive-700 dark:text-olive-500 bg-olive-100/60 dark:bg-olive-700/15"
      : rule.kind === "expense"
        ? "text-rust-600 bg-rust-100/40 dark:bg-rust-700/15"
        : "text-navy-700 dark:text-navy-300 bg-navy-100/60 dark:bg-navy-700/20";

  const accountLabel =
    rule.kind === "transfer"
      ? `${rule.from_account?.name ?? "—"} → ${rule.to_account?.name ?? "—"}`
      : (rule.account?.name ?? "—");

  const handleToggle = () => {
    startTransition(async () => {
      const r = await setRecurringRuleActive(rule.id, !rule.is_active);
      if (r.error) toast.error(r.error);
      else toast.success(rule.is_active ? "Pausada." : "Reativada.");
    });
  };

  const handleMaterialize = () => {
    startTransition(async () => {
      const r = await materializeRecurrenceNow(rule.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        (r.created ?? 0) === 0
          ? "Nada novo."
          : `${r.created} lançamento${r.created === 1 ? "" : "s"} criado${r.created === 1 ? "" : "s"}.`,
      );
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      eyebrow: "Ação irreversível",
      title: `Excluir "${rule.description}"?`,
      description: "Lançamentos passados ficam, futuros já gerados são apagados.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteRecurringRule(rule.id);
      if (r.error) toast.error(r.error);
      else toast.success("Excluída.");
    });
  };

  const nextText = nextOccurrences[0] ? formatDateShort(nextOccurrences[0]) : "—";

  return (
    <>
      <div
        className={cn(
          "group grid grid-cols-[24px_1fr_auto_auto_auto] items-center gap-3 py-2.5 px-3 rounded-[8px] hover:bg-surface-muted/60 transition-colors",
          pending && "opacity-60",
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "w-6 h-6 rounded-full grid place-items-center shrink-0",
            kindColor,
          )}
          aria-hidden
        >
          {kindIcon}
        </div>

        {/* Descrição + conta — clicável pra editar */}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left min-w-0 group/btn"
        >
          <div className="font-medium text-[13.5px] text-foreground tracking-[-0.005em] truncate group-hover/btn:text-navy-700">
            {rule.description}
          </div>
          <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] truncate mt-0.5">
            {accountLabel}
            {rule.category ? ` · ${rule.category.name}` : ""}
          </div>
        </button>

        {/* Frequência */}
        <div className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
          {describeFrequencyShort(rule)}
        </div>

        {/* Próxima data — popover com as próximas 3 */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground whitespace-nowrap inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-muted transition-colors"
              aria-label="Ver próximas datas"
            >
              <Calendar className="w-3 h-3" strokeWidth={1.7} />
              {nextText}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="top"
              sideOffset={6}
              align="end"
              className="z-50 rounded-[8px] border border-border-strong bg-surface shadow-md px-3.5 py-2.5 text-[12px] font-mono space-y-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              <div className="text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1.5">
                Próximas
              </div>
              {nextOccurrences.length === 0 ? (
                <div className="text-muted-foreground">—</div>
              ) : (
                nextOccurrences.slice(0, 3).map((d) => (
                  <div key={d} className="flex items-center gap-2 text-foreground">
                    <span className="inline-block w-1 h-1 rounded-full bg-navy-600" />
                    {formatDateShort(d)}
                  </div>
                ))
              )}
              <Popover.Arrow className="fill-surface stroke-border-strong" width={10} height={5} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Valor */}
        <div className="flex items-center gap-2 min-w-[120px] justify-end">
          <Money
            value={Number(rule.amount)}
            currency={rule.currency}
            showComparison
            className="text-[13.5px] font-medium tracking-[-0.005em] items-end text-foreground"
            secondaryClassName="text-[9.5px]"
          />
          <div className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1.5">
            <RowActionsMenu
              actions={[
                {
                  label: "Editar",
                  icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setEditing(true),
                  disabled: pending,
                },
                {
                  label: "Materializar agora",
                  icon: <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleMaterialize,
                  disabled: pending || !rule.is_active,
                },
                {
                  label: rule.is_active ? "Pausar" : "Reativar",
                  icon: rule.is_active ? (
                    <Pause className="w-3.5 h-3.5" strokeWidth={1.7} />
                  ) : (
                    <Play className="w-3.5 h-3.5" strokeWidth={1.7} />
                  ),
                  onSelect: handleToggle,
                  disabled: pending,
                },
                {
                  label: "Excluir",
                  icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleDelete,
                  disabled: pending,
                  danger: true,
                },
              ]}
            />
          </div>
        </div>
      </div>
      <RecurrenceSheet
        open={editing}
        onOpenChange={setEditing}
        rule={rule}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
