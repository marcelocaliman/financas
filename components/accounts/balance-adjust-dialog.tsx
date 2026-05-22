"use client";

import { useState, useTransition } from "react";
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
import { adjustAccountBalance } from "@/services/accounts.actions";
import { formatMoney } from "@/lib/utils/format";
import type { Tables } from "@/types/database";

type Account = Tables<"accounts">;

export function BalanceAdjustDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account: Account;
}) {
  const currentBalance = Number(account.current_balance);
  const [target, setTarget] = useState<number>(currentBalance);
  const [pending, startTransition] = useTransition();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setTarget(currentBalance);
  }

  const delta = Math.round((target - currentBalance) * 100) / 100;

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const r = await adjustAccountBalance(formData);
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          delta === 0
            ? "Nada para ajustar."
            : `Ajuste de ${formatMoney(Math.abs(delta))} registrado.`,
        );
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={`Ajustar saldo · ${account.name}`}
          title="Reconciliar o saldo."
          description="Em vez de sobrescrever o saldo, criamos uma transação de ajuste com a diferença — assim o histórico fica auditável e nada quebra."
        />
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="accountId" value={account.id} />

          <div className="rounded-[10px] bg-bone-100 dark:bg-ink-800 px-4 py-3 space-y-1 text-[12.5px] font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo atual</span>
              <b className="text-foreground">{formatMoney(currentBalance)}</b>
            </div>
          </div>

          <Field label="Saldo desejado" htmlFor="targetBalance" required>
            <MoneyInput
              name="targetBalance"
              id="targetBalance"
              defaultValue={currentBalance}
              onValueChange={setTarget}
              autoFocus
              size="lg"
            />
          </Field>

          {delta !== 0 ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[12.5px] font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Será criada uma transação</span>
                <span
                  className={
                    delta > 0
                      ? "text-olive-700 dark:text-olive-500 font-medium"
                      : "text-rust-600 font-medium"
                  }
                >
                  {delta > 0 ? "Receita" : "Despesa"} · {formatMoney(Math.abs(delta))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Novo saldo</span>
                <b className="text-foreground">{formatMoney(target)}</b>
              </div>
            </div>
          ) : null}

          <Field label="Motivo (opcional)" htmlFor="notes" hint="Aparece como descrição da transação">
            <Input
              id="notes"
              name="notes"
              placeholder="Ex.: aplicação retroativa do Tesouro Selic"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending || delta === 0}>
              {pending ? "Salvando…" : delta === 0 ? "Sem alteração" : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
