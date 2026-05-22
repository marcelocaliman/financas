"use client";

import { useState, useTransition } from "react";
import { Archive, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import {
  archiveYieldRule,
  deleteYieldRule,
  restoreYieldRule,
} from "@/services/redemptions.actions";
import type { YieldRule } from "@/services/redemptions";
import { RuleSheet } from "./rule-sheet";

type InvestmentLite = { id: string; ticker: string; name: string };
type AccountLite = { id: string; name: string; institution: string };

export function RuleRowActions({
  rule,
  investments,
  destinations,
}: {
  rule: YieldRule;
  investments: InvestmentLite[];
  destinations: AccountLite[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleArchive = () => {
    if (!confirm(`Arquivar regra de saque de "${rule.investment?.ticker ?? "ativo"}"?`)) return;
    startTransition(async () => {
      const r = await archiveYieldRule(rule.id);
      if (r.error) toast.error(r.error);
      else toast.success("Regra arquivada.");
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const r = await restoreYieldRule(rule.id);
      if (r.error) toast.error(r.error);
      else toast.success("Regra restaurada.");
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        `Excluir regra DEFINITIVAMENTE? Apaga lembretes pendentes (saques já executados continuam no histórico).`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteYieldRule(rule.id);
      if (r.error) toast.error(r.error);
      else toast.success("Regra excluída.");
    });
  };

  return (
    <>
      <RowActionsMenu
        actions={
          rule.is_active
            ? [
                {
                  label: "Editar regra",
                  icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setEditing(true),
                  disabled: pending,
                },
                {
                  label: "Arquivar",
                  icon: <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleArchive,
                  disabled: pending,
                  danger: true,
                },
                {
                  label: "Excluir definitivamente",
                  icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleDelete,
                  disabled: pending,
                  danger: true,
                },
              ]
            : [
                {
                  label: "Restaurar",
                  icon: <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleRestore,
                  disabled: pending,
                },
                {
                  label: "Excluir definitivamente",
                  icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleDelete,
                  disabled: pending,
                  danger: true,
                },
              ]
        }
      />
      <RuleSheet
        open={editing}
        onOpenChange={setEditing}
        rule={rule}
        investments={investments}
        destinations={destinations}
      />
    </>
  );
}
