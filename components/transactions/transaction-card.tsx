"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Pencil, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, formatMoneyParts } from "@/lib/utils/format";
import { deleteTransaction } from "@/services/transactions.actions";
import type { Transaction } from "@/services/transactions";
import { convert, formatCurrency } from "@/lib/financial/currency";
import { useMoneyContext } from "@/components/ui/money-provider";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { cn } from "@/lib/utils/cn";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TransactionTagsEditor } from "./transaction-tags-editor";

type AccountLite = { id: string; name: string; institution: string };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

/**
 * Versão card de TransactionRow — usada apenas no mobile.
 * Cada linha empilha verticalmente com valor proeminente à direita,
 * descrição em destaque acima, e metadados (conta, categoria, tags) abaixo.
 * Ações de editar/apagar sempre visíveis numa linha dedicada no rodapé.
 */
export function TransactionCard({
  tx,
  accounts,
  categories,
}: {
  tx: Transaction;
  accounts: AccountLite[];
  categories: CategoryLite[];
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

  const { displayCurrency, rates } = useMoneyContext();
  const txCurrency = (tx.currency ?? "BRL") as "BRL" | "EUR" | "USD";
  const convertedAmount = convert(Number(tx.amount), txCurrency, displayCurrency, rates) ?? Number(tx.amount);
  const finalCurrency = txCurrency !== displayCurrency && convertedAmount !== Number(tx.amount)
    ? displayCurrency
    : txCurrency;
  const { integer, cents, currency: symbol } = formatMoneyParts(convertedAmount, finalCurrency);
  const showSecondary = txCurrency !== finalCurrency;
  const isIncome = tx.kind === "income";
  const isTransfer = tx.kind === "transfer";

  const valueClass = isIncome ? "text-olive-700" : "text-foreground";
  const valuePrefix = isIncome ? "+ " : isTransfer ? "" : "− ";

  return (
    <>
      <div
        className={cn(
          "px-4 py-3 border-b border-border last:border-b-0 transition-colors active:bg-bone-100/40 dark:active:bg-ink-800/40",
          pending && "opacity-50",
        )}
      >
        {/* Linha 1: descrição + valor */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-[14.5px] text-foreground tracking-[-0.005em] flex items-center gap-1.5 leading-tight">
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
            </div>
            <div className="font-mono text-[11px] text-faint-foreground tracking-[0.02em] mt-1 truncate">
              <span>{formatDateShort(tx.date)}</span>
              <span className="mx-1">·</span>
              <span>{tx.account?.name ?? "—"}</span>
              {tx.payment_method ? (
                <>
                  <span className="mx-1">·</span>
                  <span>{tx.payment_method}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end leading-tight shrink-0">
            <span
              className={cn(
                "font-mono text-[15px] font-medium tracking-[-0.005em] whitespace-nowrap",
                valueClass,
              )}
            >
              {valuePrefix}
              {symbol} <MoneyMask>{integer},{cents}</MoneyMask>
            </span>
            {showSecondary ? (
              <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.02em]">
                <MoneyMask>{formatCurrency(Number(tx.amount), txCurrency)}</MoneyMask>
              </span>
            ) : null}
          </div>
        </div>

        {/* Linha 2: categoria + tags + ações */}
        <div className="flex items-center justify-between gap-2 mt-2.5">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
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
            <TransactionTagsEditor transactionId={tx.id} tags={tx.tags ?? []} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              className="p-2 rounded-[6px] text-faint-foreground active:text-foreground active:bg-surface-muted"
              aria-label="Editar"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.7} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="p-2 rounded-[6px] text-faint-foreground active:text-rust-600 active:bg-rust-100/50 dark:active:bg-rust-700/30"
              aria-label="Apagar"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </div>
      <EditTransactionDialog
        open={editing}
        onOpenChange={setEditing}
        transaction={tx}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
