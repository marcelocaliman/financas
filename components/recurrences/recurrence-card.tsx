"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, ArrowUpRight, ArrowDownLeft, Pencil, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
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

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };
type Rule = Tables<"recurring_rules"> & {
  account?: { id: string; name: string; institution: string } | null;
  from_account?: { id: string; name: string; institution: string } | null;
  to_account?: { id: string; name: string; institution: string } | null;
  category?: { id: string; name: string; color: string | null; icon: string | null } | null;
};

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "dia",
  weekly: "semana",
  monthly: "mês",
  yearly: "ano",
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function describeFrequency(rule: Rule): string {
  const each = rule.interval_count > 1 ? `${rule.interval_count} ` : "";
  const unit = FREQUENCY_LABELS[rule.frequency];
  let base = `A cada ${each}${unit}${rule.interval_count > 1 ? "s" : ""}`;
  if (rule.frequency === "weekly" && rule.day_of_week != null) {
    base += ` · ${WEEKDAYS[rule.day_of_week]}`;
  } else if (rule.frequency === "monthly" && rule.day_of_month) {
    base += ` · dia ${rule.day_of_month}`;
  }
  return base;
}

export function RecurrenceCard({
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

  const kindIcon =
    rule.kind === "income" ? (
      <ArrowDownLeft className="w-4 h-4" strokeWidth={1.7} />
    ) : rule.kind === "expense" ? (
      <ArrowUpRight className="w-4 h-4" strokeWidth={1.7} />
    ) : (
      <ArrowLeftRight className="w-4 h-4" strokeWidth={1.7} />
    );

  const tone =
    rule.kind === "income" ? "olive" : rule.kind === "expense" ? "neutral" : "navy";

  const accountLabel =
    rule.kind === "transfer"
      ? `${rule.from_account?.name ?? "—"} → ${rule.to_account?.name ?? "—"}`
      : rule.account?.name ?? "—";

  const handleToggle = () => {
    startTransition(async () => {
      const r = await setRecurringRuleActive(rule.id, !rule.is_active);
      if (r.error) toast.error(r.error);
      else toast.success(rule.is_active ? "Recorrência pausada." : "Recorrência reativada.");
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
          ? "Nada novo pra criar agora."
          : `${r.created} lançamento${r.created === 1 ? "" : "s"} criado${r.created === 1 ? "" : "s"}.`,
      );
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        `Excluir a recorrência "${rule.description}"? Lançamentos passados ficam, mas as ocorrências FUTURAS já geradas serão apagadas.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await deleteRecurringRule(rule.id);
      if (r.error) toast.error(r.error);
      else toast.success("Recorrência excluída.");
    });
  };

  return (
    <>
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border bg-surface p-6 grid sm:grid-cols-[1fr_220px] gap-6 group",
          rule.is_active
            ? "border-border hover:shadow-sm transition-shadow"
            : "border-dashed border-border-strong opacity-65",
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge tone={tone} dot>
              <span className="inline-flex items-center gap-1">
                {kindIcon}
                {rule.kind === "income" ? "Receita" : rule.kind === "expense" ? "Despesa" : "Transferência"}
              </span>
            </Badge>
            {!rule.is_active ? <Badge tone="gold">Pausada</Badge> : null}
            {rule.category ? (
              <span className="text-[11.5px] text-faint-foreground font-mono">
                · {rule.category.name}
              </span>
            ) : null}
          </div>
          <div className="font-display text-[20px] tracking-[-0.015em] text-foreground truncate">
            {rule.description}
          </div>
          <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.04em] mt-1">
            {accountLabel}
            {rule.payment_method ? ` · ${rule.payment_method}` : ""}
          </div>

          <div className="mt-4 flex items-baseline gap-3 flex-wrap">
            <Money
              value={Number(rule.amount)}
              currency={rule.currency}
              showComparison
              className="text-[22px] tracking-[-0.02em] items-start text-foreground"
              secondaryClassName="text-[11px]"
            />
            <span className="font-mono text-[11.5px] text-muted-foreground">
              {describeFrequency(rule)}
            </span>
          </div>

          {rule.notes ? (
            <p className="text-[12.5px] text-muted-foreground mt-3 line-clamp-2">{rule.notes}</p>
          ) : null}

          <div className="mt-3 font-mono text-[10.5px] text-faint-foreground tracking-[0.04em]">
            Início {formatDateShort(rule.start_date)}
            {rule.end_date ? ` · termina ${formatDateShort(rule.end_date)}` : null}
            {rule.last_materialized_date
              ? ` · última geração ${formatDateShort(rule.last_materialized_date)}`
              : null}
          </div>
        </div>

        <div className="sm:border-l sm:border-border sm:pl-6 -mt-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground mb-2 font-medium">
            Próximas
          </div>
          {nextOccurrences.length === 0 ? (
            <div className="text-[12.5px] text-muted-foreground italic">
              Sem datas futuras (chegou ao fim?)
            </div>
          ) : (
            <ul className="space-y-1.5 mb-3">
              {nextOccurrences.map((d) => (
                <li
                  key={d}
                  className="font-mono text-[12.5px] text-foreground flex items-center gap-1.5"
                >
                  <span className="inline-block w-1 h-1 rounded-full bg-navy-600" />
                  {formatDateShort(d)}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
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
