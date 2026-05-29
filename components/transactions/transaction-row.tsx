"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, History, Pencil, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, formatMoneyParts } from "@/lib/utils/format";
import { deleteTransaction, toggleHistoricalIrOnly } from "@/services/transactions.actions";
import type { Transaction } from "@/services/transactions";
import { convert, formatCurrency } from "@/lib/financial/currency";
import { useMoneyContext } from "@/components/ui/money-provider";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { cn } from "@/lib/utils/cn";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { TransactionTagsEditor } from "./transaction-tags-editor";
import type { Tables } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };
type DebtLite = { id: string; description: string };
type FonteLite = Pick<
  Tables<"fontes_pagadoras">,
  "id" | "name" | "type" | "cnpj" | "cpf"
>;
type TripLite = { id: string; name: string; destination: string };

export function TransactionRow({
  tx,
  accounts,
  categories,
  debts = [],
  fontes = [],
  trips = [],
}: {
  tx: Transaction;
  accounts: AccountLite[];
  categories: CategoryLite[];
  debts?: DebtLite[];
  fontes?: FonteLite[];
  trips?: TripLite[];
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: tx.transfer_pair_id ? "Apagar essa transferência?" : "Apagar esse lançamento?",
      description: tx.transfer_pair_id
        ? "As duas pontas (saída e entrada) somem juntas."
        : undefined,
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteTransaction(tx.id);
      if (r.error) toast.error(r.error);
      else toast.success("Lançamento apagado.");
    });
  };

  const handleToggleHistorical = async () => {
    const newValue = !tx.is_historical_ir_only;
    if (newValue) {
      const ok = await confirm({
        title: "Marcar como histórica IR?",
        description:
          "Some do saldo da conta, dos gráficos e do dashboard. Continua aparecendo nos relatórios do IR pra você declarar. Use quando o pagamento já saiu na vida real mas você lançou no app só pra IR.",
        confirmLabel: "Marcar histórica",
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const r = await toggleHistoricalIrOnly(tx.id, newValue);
      if (r.error) toast.error(r.error);
      else
        toast.success(
          newValue
            ? "Marcada como histórica IR (não afeta saldo)."
            : "Voltou a ser lançamento operacional.",
        );
    });
  };

  const { displayCurrency, rates } = useMoneyContext();
  const txCurrency = (tx.currency ?? "BRL") as "BRL" | "EUR" | "USD" | "GBP";
  const convertedAmount = convert(Number(tx.amount), txCurrency, displayCurrency, rates) ?? Number(tx.amount);
  const finalCurrency = txCurrency !== displayCurrency && convertedAmount !== Number(tx.amount)
    ? displayCurrency
    : txCurrency;
  const { integer, cents, currency: symbol } = formatMoneyParts(convertedAmount, finalCurrency);
  const showSecondary = txCurrency !== finalCurrency;
  const isIncome = tx.kind === "income";
  const isTransfer = tx.kind === "transfer";

  const valueClass = isIncome
    ? "text-olive-700"
    : isTransfer
      ? "text-foreground"
      : "text-foreground";

  const valuePrefix = isIncome ? "+ " : isTransfer ? "" : "− ";

  return (
    <>
      <tr
        className={cn(
          "border-b border-border last:border-b-0 group transition-colors hover:bg-bone-100/40 dark:hover:bg-ink-800/40",
          pending && "opacity-50",
        )}
      >
        <td className="py-3.5 pr-4 align-middle whitespace-nowrap">
          <span className="font-mono text-[11.5px] tracking-[0.04em] text-muted-foreground">
            {formatDateShort(tx.date)}
          </span>
        </td>
        <td className="py-3 pr-4 align-middle min-w-0">
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0">
            <span className="flex items-center gap-1.5 min-w-0 font-medium text-[14px] text-foreground tracking-[-0.005em]">
              {isTransfer ? (
                <ArrowLeftRight
                  className="w-3 h-3 text-navy-600 shrink-0"
                  strokeWidth={1.8}
                />
              ) : null}
              {tx.is_recurring ? (
                <Repeat
                  className="w-3 h-3 text-faint-foreground shrink-0"
                  strokeWidth={1.8}
                  aria-label="Lançamento recorrente"
                />
              ) : null}
              <span className="truncate">{tx.description}</span>
              {tx.is_historical_ir_only ? (
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-surface-muted text-faint-foreground border border-border shrink-0"
                  title="Lançamento histórico — informativo pra IR, não afeta saldo nem entra em sobra/gráficos."
                >
                  histórica · IR
                </span>
              ) : null}
              {tx.debt ? (
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-gold-100/60 dark:bg-gold-700/20 text-gold-700 dark:text-gold-500 border border-gold-600/40 shrink-0 inline-flex items-center gap-1"
                  title={`Pagamento da dívida: ${tx.debt.description}. Saldo da dívida atualiza automaticamente.`}
                >
                  ↓ {tx.debt.description}
                </span>
              ) : null}
            </span>
            <span className="font-mono text-[11px] text-faint-foreground tracking-[0.02em] whitespace-nowrap shrink-0">
              {tx.account?.name ?? "—"}
              {tx.payment_method ? ` · ${tx.payment_method}` : ""}
            </span>
            <div className="shrink-0">
              <TransactionTagsEditor
                transactionId={tx.id}
                tags={tx.tags ?? []}
              />
            </div>
          </div>
        </td>
        <td className="py-3.5 pr-4 align-middle whitespace-nowrap">
          {tx.category ? (
            <Badge tone={tx.category.kind === "income" ? "olive" : "neutral"} dot>
              {tx.category.name}
            </Badge>
          ) : isTransfer ? (
            <Badge tone="navy" dot>
              Transferência
            </Badge>
          ) : (
            <span className="text-faint-foreground text-[11.5px] italic">sem categoria</span>
          )}
        </td>
        <td className="py-3.5 align-middle text-right whitespace-nowrap">
          <div className="flex flex-col items-end leading-tight">
            <span
              className={cn(
                "font-mono text-[14px] font-medium tracking-[-0.005em]",
                valueClass,
              )}
            >
              {valuePrefix}{symbol} <MoneyMask>{integer},{cents}</MoneyMask>
            </span>
            {showSecondary ? (
              <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.02em]">
                <MoneyMask>{formatCurrency(Number(tx.amount), txCurrency)}</MoneyMask>
              </span>
            ) : null}
          </div>
        </td>
        <td className="py-3.5 pl-2 align-middle whitespace-nowrap">
          <div className="flex items-center gap-0.5">
            {/* Histórica IR: já paga na vida real, não mexe no saldo,
                só conta pro relatório de IR. Transfers não podem virar
                históricas (mexem no saldo de 2 contas). */}
            {tx.kind !== "transfer" ? (
              <IconButton
                tooltip={
                  tx.is_historical_ir_only
                    ? "Voltar a ser operacional"
                    : "Marcar como já paga (só conta pro IR)"
                }
                tone={tx.is_historical_ir_only ? "active" : "neutral"}
                onClick={handleToggleHistorical}
                disabled={pending}
              >
                <History className="w-3.5 h-3.5" strokeWidth={1.7} />
              </IconButton>
            ) : null}
            <IconButton
              tooltip="Editar lançamento"
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
            </IconButton>
            <IconButton
              tooltip={tx.transfer_pair_id ? "Apagar transferência" : "Apagar lançamento"}
              tone="danger"
              onClick={handleDelete}
              disabled={pending}
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
            </IconButton>
          </div>
        </td>
      </tr>
      <EditTransactionDialog
        open={editing}
        onOpenChange={setEditing}
        transaction={tx}
        accounts={accounts}
        categories={categories}
        debts={debts}
        fontes={fontes}
        trips={trips}
      />
    </>
  );
}
