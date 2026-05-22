"use client";

import { useState, useTransition } from "react";
import {
  Archive,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  ArrowDownToLine,
} from "lucide-react";
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
import { MovementDialog } from "./movement-dialog";
import { MovementsSheet } from "./movements-sheet";
import { FixedIncomeContributionDialog } from "./fixed-income-contribution-dialog";
import { WithdrawYieldDialog } from "./withdraw-yield-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Investment = Tables<"investments"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
};
type AccountLite = { id: string; name: string; institution: string };

export function InvestmentRowActions({
  investment,
  investmentAccounts,
  destinationAccounts = [],
  accumulatedYield = 0,
}: {
  investment: Investment;
  investmentAccounts: AccountLite[];
  destinationAccounts?: AccountLite[];
  accumulatedYield?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [registeringYield, setRegisteringYield] = useState(false);
  const [withdrawingYield, setWithdrawingYield] = useState(false);
  const [movementMode, setMovementMode] = useState<"buy" | "sell" | null>(null);
  const [showExtract, setShowExtract] = useState(false);
  const [aportingFixed, setAportingFixed] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const isMarketable =
    investment.asset_type === "fii" ||
    investment.asset_type === "stock" ||
    investment.asset_type === "etf" ||
    investment.asset_type === "crypto";
  const isFixedIncome =
    investment.asset_type === "fixed_income_public" ||
    investment.asset_type === "fixed_income_private";

  const handleArchive = async () => {
    const ok = await confirm({
      title: `Arquivar "${investment.ticker}"?`,
      description: "Some das listas mas o histórico fica.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
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

  const handleDelete = async () => {
    const ok = await confirm({
      eyebrow: "Ação irreversível",
      title: `Excluir "${investment.ticker}" DEFINITIVAMENTE?`,
      description: "Apaga rendimentos mensais e regras de saque associados.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
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
                ...(isMarketable
                  ? [
                      {
                        label: "Novo aporte",
                        icon: <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />,
                        onSelect: () => setMovementMode("buy"),
                        disabled: pending,
                      },
                      {
                        label: "Vender",
                        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
                        onSelect: () => setMovementMode("sell"),
                        disabled: pending,
                      },
                      {
                        label: "Ver extrato",
                        icon: <List className="w-3.5 h-3.5" strokeWidth={1.7} />,
                        onSelect: () => setShowExtract(true),
                        disabled: pending,
                      },
                    ]
                  : []),
                ...(isFixedIncome
                  ? [
                      {
                        label: "Aportar mais",
                        icon: <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />,
                        onSelect: () => setAportingFixed(true),
                        disabled: pending,
                      },
                      {
                        label: "Sacar rendimento",
                        icon: <ArrowDownToLine className="w-3.5 h-3.5" strokeWidth={1.7} />,
                        onSelect: () => {
                          if (destinationAccounts.length === 0) {
                            toast.error(
                              "Crie uma conta corrente/poupança pra receber o saque.",
                            );
                            return;
                          }
                          setWithdrawingYield(true);
                        },
                        disabled: pending || accumulatedYield <= 0,
                      },
                    ]
                  : []),
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
      {isMarketable ? (
        <>
          <MovementDialog
            open={movementMode !== null}
            onOpenChange={(o) => !o && setMovementMode(null)}
            investment={investment}
            defaultKind={movementMode ?? "buy"}
          />
          <MovementsSheet
            open={showExtract}
            onOpenChange={setShowExtract}
            investment={investment}
          />
        </>
      ) : null}
      {isFixedIncome ? (
        <>
          <FixedIncomeContributionDialog
            open={aportingFixed}
            onOpenChange={setAportingFixed}
            investment={investment}
          />
          <WithdrawYieldDialog
            open={withdrawingYield}
            onOpenChange={setWithdrawingYield}
            investment={investment}
            accumulatedYield={accumulatedYield}
            destinationAccounts={destinationAccounts}
          />
        </>
      ) : null}
    </>
  );
}
