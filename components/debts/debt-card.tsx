"use client";

import { useState, useTransition } from "react";
import { Archive, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { Money } from "@/components/ui/money";
import { archiveDebt, deleteDebt } from "@/services/debts.actions";
import { DEBT_KIND_LABELS } from "@/lib/financial/debt-labels";
import { DebtSheet } from "./debt-sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { MarriageRegime, Tables } from "@/types/database";

type Debt = Tables<"debts">;
type Asset = Pick<Tables<"physical_assets">, "id" | "name" | "category">;

export function DebtCard({
  debt,
  assets = [],
  filers = [],
  regime = "solteiro",
}: {
  debt: Debt;
  assets?: Asset[];
  filers?: Tables<"ir_filers">[];
  regime?: MarriageRegime;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const current = Number(debt.current_balance);
  const original = Number(debt.original_amount);
  const paidPct = original > 0 ? 1 - current / original : 0;
  const declarable = current > 5000;

  async function handleArchive() {
    const ok = await confirm({
      title: `Arquivar "${debt.description}"?`,
      description: "Vai sumir da lista ativa mas continua no histórico.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveDebt(debt.id);
      if (r.error) toast.error(r.error);
      else toast.success("Arquivada.");
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Excluir "${debt.description}"?`,
      description: "Operação irreversível.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteDebt(debt.id);
      if (r.error) toast.error(r.error);
      else toast.success("Excluída.");
    });
  }

  return (
    <>
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge tone="navy">{DEBT_KIND_LABELS[debt.kind]}</Badge>
              {declarable ? <Badge tone="gold">Declarável IR</Badge> : null}
            </div>
            <div className="font-display text-[17px] tracking-[-0.015em] text-foreground truncate">
              {debt.description}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-1">
              {debt.creditor_name}
              {debt.creditor_cnpj_cpf ? (
                <span className="font-mono text-[11px] ml-1.5">· {debt.creditor_cnpj_cpf}</span>
              ) : null}
            </div>
          </div>

          <RowActionsMenu
            actions={[
              {
                label: "Editar",
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
                label: "Excluir",
                icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
                onSelect: handleDelete,
                disabled: pending,
                danger: true,
              },
            ]}
          />
        </div>

        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
          Saldo devedor
        </div>
        <Money
          value={current}
          currency={debt.currency}
          className="text-[22px] tracking-[-0.02em] mt-1 text-rust-600 items-start"
        />

        {original > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-mono">
            <span className="text-muted-foreground">
              Original: {original.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            {paidPct > 0.01 ? (
              <span className="text-olive-700 dark:text-olive-200">
                {(paidPct * 100).toFixed(1).replace(".", ",")}% quitado
              </span>
            ) : null}
            {debt.interest_rate ? (
              <span className="text-faint-foreground">
                {Number(debt.interest_rate).toFixed(2).replace(".", ",")}% a.a.
              </span>
            ) : null}
          </div>
        ) : null}

        {debt.end_date ? (
          <div className="mt-1.5 text-[11.5px] text-muted-foreground">
            Quita em {new Date(debt.end_date).toLocaleDateString("pt-BR")}
          </div>
        ) : null}
      </div>

      <DebtSheet
        open={editing}
        onOpenChange={setEditing}
        debt={debt}
        assets={assets}
        filers={filers}
        regime={regime}
      />
    </>
  );
}
