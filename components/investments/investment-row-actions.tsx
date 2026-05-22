"use client";

import { useState, useTransition } from "react";
import { Archive, Pencil, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import {
  archiveInvestment,
  deleteInvestment,
  restoreInvestment,
} from "@/services/investments.actions";
import type { Tables } from "@/types/database";
import { InvestmentSheet } from "./investment-sheet";
import { YieldDialog } from "./yield-dialog";

type Investment = Tables<"investments">;
type AccountLite = { id: string; name: string; institution: string };

export function InvestmentRowActions({
  investment,
  investmentAccounts,
}: {
  investment: Investment;
  investmentAccounts: AccountLite[];
}) {
  const [editing, setEditing] = useState(false);
  const [registeringYield, setRegisteringYield] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleArchive = () => {
    if (!confirm(`Arquivar "${investment.ticker}"? Some das listas mas o histórico fica.`))
      return;
    startTransition(async () => {
      const r = await archiveInvestment(investment.id);
      if (r.error) toast.error(r.error);
      else toast.success("Ativo arquivado.");
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const r = await restoreInvestment(investment.id);
      if (r.error) toast.error(r.error);
      else toast.success("Ativo restaurado.");
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        `Excluir "${investment.ticker}" DEFINITIVAMENTE? Apaga rendimentos mensais e regras de saque associados. Esta ação é irreversível.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteInvestment(investment.id);
      if (r.error) toast.error(r.error);
      else toast.success("Ativo excluído.");
    });
  };

  return (
    <>
      <RowActionsMenu
        actions={
          investment.is_active
            ? [
                {
                  label: "Editar ativo",
                  icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setEditing(true),
                  disabled: pending,
                },
                {
                  label: "Registrar rendimento do mês",
                  icon: <Sparkles className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setRegisteringYield(true),
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
      <InvestmentSheet
        open={editing}
        onOpenChange={setEditing}
        investment={investment}
        investmentAccounts={investmentAccounts}
      />
      <YieldDialog
        open={registeringYield}
        onOpenChange={setRegisteringYield}
        investment={investment}
      />
    </>
  );
}
