"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive, RotateCcw, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { Money } from "@/components/ui/money";
import {
  archiveAccount,
  deleteAccount,
  restoreAccount,
} from "@/services/accounts.actions";
import type { AccountType, Tables } from "@/types/database";
import { AccountSheet } from "./account-sheet";
import { BalanceAdjustDialog } from "./balance-adjust-dialog";

type Account = Tables<"accounts">;

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão",
  investment: "Investimento",
  cash: "Dinheiro",
};

export function AccountCard({
  account,
  displayBalance,
  balanceMode = "current",
  balanceLabel,
}: {
  account: Account;
  /** Saldo a exibir; default = account.current_balance */
  displayBalance?: number;
  /** "current" = saldo atual; "historical" = saldo retroativo; "forecast" = previsto */
  balanceMode?: "current" | "historical" | "forecast";
  /** Sobrescreve "Saldo atual" quando viewing past/future */
  balanceLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleArchive = () => {
    if (!confirm(`Arquivar "${account.name}"? Aparece em "Arquivadas" e some das listas.`)) return;
    startTransition(async () => {
      const r = await archiveAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta arquivada.");
    });
  };
  const handleRestore = () => {
    startTransition(async () => {
      const r = await restoreAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta restaurada.");
    });
  };
  const handleDelete = () => {
    if (
      !confirm(
        `Excluir "${account.name}" DEFINITIVAMENTE? Só funciona se a conta NÃO tem transações nem investimentos. Caso contrário, use arquivar.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta excluída.");
    });
  };

  const balance = displayBalance ?? Number(account.current_balance ?? 0);
  const balanceColor =
    account.type === "credit_card"
      ? balance < 0
        ? "text-rust-600"
        : "text-foreground"
      : balance >= 0
        ? "text-foreground"
        : "text-rust-600";
  const labelText =
    balanceLabel ??
    (balanceMode === "historical"
      ? "Saldo no fim do mês"
      : balanceMode === "forecast"
        ? "Saldo previsto"
        : "Saldo atual");

  return (
    <>
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border bg-surface p-6 relative group",
          "transition-shadow duration-200",
          account.is_active ? "border-border hover:shadow-sm" : "border-dashed border-border-strong opacity-70",
        )}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="navy">{TYPE_LABELS[account.type]}</Badge>
              {!account.is_active ? <Badge tone="gold">Arquivada</Badge> : null}
            </div>
            <div className="font-display text-[20px] tracking-[-0.015em] text-foreground truncate">
              {account.name}
            </div>
            <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
              {account.institution}
            </div>
          </div>
          {account.is_active ? (
            <RowActionsMenu
              actions={[
                {
                  label: "Editar nome/tipo",
                  icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setEditing(true),
                  disabled: pending,
                },
                {
                  label: "Ajustar saldo",
                  icon: <Scale className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setAdjusting(true),
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
              ]}
            />
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={handleRestore} disabled={pending}>
                <RotateCcw className="w-3 h-3" strokeWidth={1.7} />
                Restaurar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={pending}
                aria-label="Excluir definitivamente"
                className="text-rust-600"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium flex items-center gap-1.5">
            {labelText}
            {balanceMode === "forecast" ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-gold-600/15 text-gold-700 dark:text-gold-500 text-[9.5px] font-mono tracking-[0.12em] uppercase">
                Previsão
              </span>
            ) : null}
          </div>
          <Money
            value={balance}
            currency={account.currency}
            showComparison
            className={cn("text-[24px] tracking-[-0.02em] mt-1 items-start", balanceColor)}
            secondaryClassName="text-[11px]"
          />
        </div>
      </div>

      {account.is_active ? (
        <>
          <AccountSheet open={editing} onOpenChange={setEditing} account={account} />
          <BalanceAdjustDialog open={adjusting} onOpenChange={setAdjusting} account={account} />
        </>
      ) : null}
    </>
  );
}
