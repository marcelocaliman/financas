"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  addToFixedIncome,
  type ContributionFormState,
} from "@/services/fixed-income-contribution.actions";
import { formatMoney } from "@/lib/utils/format";
import type { Tables } from "@/types/database";

type Investment = Tables<"investments">;

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function FixedIncomeContributionDialog({
  open,
  onOpenChange,
  investment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment: Investment;
}) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO);
  const [debit, setDebit] = useState(true);

  const [state, action, pending] = useActionState<
    ContributionFormState | undefined,
    FormData
  >(addToFixedIncome, undefined);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAmount(0);
      setDate(todayISO());
      setDebit(true);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success("Aporte registrado.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const current = Number(investment.current_balance);
  const newBalance = current + amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={`${investment.ticker} · Novo aporte`}
          title="Aportar valor."
          description="O valor é somado ao saldo do ativo. Quanto mais saldo, mais rende — a partir daí."
        />
        <form action={action} className="space-y-4">
          <input type="hidden" name="investmentId" value={investment.id} />
          <input
            type="hidden"
            name="debitAccountId"
            value={debit ? investment.account_id : ""}
          />

          <Field label="Valor a aportar" htmlFor="amount" required>
            <MoneyInput
              name="amount"
              id="amount"
              defaultValue={0}
              onValueChange={setAmount}
              autoFocus
              size="lg"
            />
          </Field>

          <Field label="Data" htmlFor="date" required>
            <Input
              id="date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px] text-muted-foreground bg-bone-100 dark:bg-ink-800 border border-border rounded-[8px] px-3 py-2.5">
            <input
              type="checkbox"
              checked={debit}
              onChange={(e) => setDebit(e.target.checked)}
              className="mt-0.5 accent-navy-700"
            />
            <span>
              <b className="text-foreground">Debitar este valor do caixa da corretora.</b>
              <br />
              <span className="text-[11.5px]">
                Cria uma transação de saída automática. Desligue se você prefere registrar à mão.
              </span>
            </span>
          </label>

          <Field label="Notas (opcional)" htmlFor="notes">
            <Input id="notes" name="notes" placeholder="Aporte mensal" />
          </Field>

          {amount > 0 ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[12.5px] font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo atual</span>
                <b className="text-foreground">{formatMoney(current)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ aporte</span>
                <b className="text-olive-700 dark:text-olive-500">+ {formatMoney(amount)}</b>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <span className="text-muted-foreground">Saldo após</span>
                <b className="text-foreground">{formatMoney(newBalance)}</b>
              </div>
            </div>
          ) : null}

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending || amount <= 0}>
              {pending ? "Salvando…" : "Registrar aporte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
