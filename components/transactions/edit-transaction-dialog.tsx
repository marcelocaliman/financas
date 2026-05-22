"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTransaction, type TxFormState } from "@/services/transactions.actions";
import type { Transaction } from "@/services/transactions";

type AccountLite = { id: string; name: string; institution: string };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: Transaction;
  accounts: AccountLite[];
  categories: CategoryLite[];
}) {
  const isTransfer = transaction.kind === "transfer";

  const [accountId, setAccountId] = useState(transaction.account_id);
  const [categoryId, setCategoryId] = useState<string>(transaction.category_id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<string>(transaction.payment_method ?? "");
  const [date, setDate] = useState<string>(transaction.date);

  const [state, action, pending] = useActionState<TxFormState | undefined, FormData>(
    updateTransaction,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAccountId(transaction.account_id);
      setCategoryId(transaction.category_id ?? "");
      setPaymentMethod(transaction.payment_method ?? "");
      setDate(transaction.date);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success("Lançamento atualizado.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const filteredCategories = categories.filter((c) =>
    transaction.kind === "income"
      ? c.kind === "income"
      : transaction.kind === "expense"
        ? c.kind === "expense"
        : false,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow="Editar"
          title={
            isTransfer ? (
              <>Editar transferência.</>
            ) : transaction.kind === "income" ? (
              <>Editar receita.</>
            ) : (
              <>Editar despesa.</>
            )
          }
          description={
            isTransfer
              ? "Transferências são pares espelhados. Aqui você ajusta descrição e data dessa linha; para alterar valor ou contas, exclua e refaça."
              : "Mude o que precisar e salve."
          }
        />

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={transaction.id} />
          <input type="hidden" name="kind" value={transaction.kind} />

          <Field htmlFor="amount" label="Valor">
            <MoneyInput
              name="amount"
              id="amount"
              defaultValue={Number(transaction.amount)}
              disabled={isTransfer}
            />
            {isTransfer ? (
              <p className="text-[11.5px] text-faint-foreground mt-1">
                Para alterar o valor da transferência, exclua o par e refaça.
              </p>
            ) : null}
          </Field>

          <Field htmlFor="tx-description" label="Descrição">
            <Input
              id="tx-description"
              name="description"
              defaultValue={transaction.description}
            />
          </Field>

          {!isTransfer ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Conta" htmlFor="accountId">
                <Select value={accountId} onValueChange={setAccountId} name="accountId">
                  <SelectTrigger id="accountId">
                    <SelectValue placeholder="Conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoria" htmlFor="categoryId">
                <Select value={categoryId} onValueChange={setCategoryId} name="categoryId">
                  <SelectTrigger id="categoryId">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : (
            <input type="hidden" name="accountId" value={accountId} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" htmlFor="date">
              <Input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            {!isTransfer ? (
              <Field label="Forma" htmlFor="paymentMethod">
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  name="paymentMethod"
                >
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="auto_debit">Débito automático</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
