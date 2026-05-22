"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, formatMoneyParts } from "@/lib/utils/format";
import { deleteTransaction } from "@/services/transactions.actions";
import type { Transaction } from "@/services/transactions";
import { convert, formatCurrency } from "@/lib/financial/currency";
import { useMoneyContext } from "@/components/ui/money-provider";
import { cn } from "@/lib/utils/cn";
import { EditTransactionDialog } from "./edit-transaction-dialog";

type AccountLite = { id: string; name: string; institution: string };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

export function TransactionRow({
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

  const handleDelete = () => {
    const msg = tx.transfer_pair_id
      ? "Apagar essa transferência? As duas pontas (saída e entrada) somem juntas."
      : "Apagar esse lançamento?";
    if (!confirm(msg)) return;
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
        <td className="py-3.5 pr-4 align-middle min-w-0">
          <div className="font-medium text-[14px] text-foreground tracking-[-0.005em] truncate flex items-center gap-2">
            {isTransfer ? (
              <ArrowLeftRight
                className="w-3 h-3 text-navy-600 shrink-0"
                strokeWidth={1.8}
              />
            ) : null}
            {tx.description}
          </div>
          <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.02em] mt-0.5 truncate">
            {tx.account?.name ?? "—"}
            {tx.payment_method ? ` · ${tx.payment_method}` : ""}
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
              {valuePrefix}{symbol} {integer},{cents}
            </span>
            {showSecondary ? (
              <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.02em]">
                {formatCurrency(Number(tx.amount), txCurrency)}
              </span>
            ) : null}
          </div>
        </td>
        <td className="py-3.5 pl-2 align-middle whitespace-nowrap">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              className="p-1.5 rounded-[6px] text-faint-foreground hover:text-foreground hover:bg-surface-muted"
              aria-label="Editar"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="p-1.5 rounded-[6px] text-faint-foreground hover:text-rust-600 hover:bg-rust-100/50 dark:hover:bg-rust-700/30"
              aria-label="Apagar"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
            </button>
          </div>
        </td>
      </tr>
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
