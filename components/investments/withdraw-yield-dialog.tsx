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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Money } from "@/components/ui/money";
import { withdrawYield, type WithdrawYieldState } from "@/services/redemptions.actions";
import type { Tables } from "@/types/database";

type Investment = Tables<"investments"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
};
type AccountLite = { id: string; name: string; institution: string };

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function WithdrawYieldDialog({
  open,
  onOpenChange,
  investment,
  accumulatedYield,
  destinationAccounts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment: Investment;
  /** Rendimento acumulado deste ativo (saldo − custo aplicado). Limite "natural" pro saque. */
  accumulatedYield: number;
  /** Contas elegíveis pra receber o saque (tipicamente checking/savings, excluindo o próprio investment). */
  destinationAccounts: AccountLite[];
}) {
  const [targetAccountId, setTargetAccountId] = useState<string>(
    destinationAccounts[0]?.id ?? "",
  );
  const [date, setDate] = useState<string>(todayISO());

  const [state, action, pending] = useActionState<WithdrawYieldState | undefined, FormData>(
    withdrawYield,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTargetAccountId(destinationAccounts[0]?.id ?? "");
      setDate(todayISO());
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success("Saque de rendimento registrado.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const currentBalance = Number(investment.current_balance ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={`Sacar rendimento · ${investment.ticker}`}
          title="Marcar saque do rendimento."
          description="Diminui o saldo do ativo e cria uma transação de receita na conta destino. Use pra registrar que parte do que rendeu foi consumida."
        />

        <form action={action} className="space-y-4">
          <input type="hidden" name="investmentId" value={investment.id} />

          <div className="rounded-[10px] bg-bone-100 dark:bg-ink-800 px-4 py-3 space-y-1 text-[12.5px] font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rendimento acumulado</span>
              <b className="text-olive-700 dark:text-olive-500">
                <Money
                  value={accumulatedYield}
                  currency={investment.currency}
                  className="text-[12.5px] inline-flex !flex-row !items-baseline"
                />
              </b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo total do ativo</span>
              <b className="text-foreground">
                <Money
                  value={currentBalance}
                  currency={investment.currency}
                  className="text-[12.5px] inline-flex !flex-row !items-baseline"
                />
              </b>
            </div>
          </div>

          <Field
            label="Valor a sacar"
            htmlFor="amount"
            required
            hint={`Máximo é o saldo total do ativo, mas conceitualmente fica no rendimento acumulado.`}
          >
            <MoneyInput name="amount" id="amount" size="lg" defaultValue={0} autoFocus />
            {state?.fieldErrors?.amount ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.amount}</p>
            ) : null}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Conta destino" htmlFor="targetAccountId" required>
              <Select
                value={targetAccountId}
                onValueChange={setTargetAccountId}
                name="targetAccountId"
              >
                <SelectTrigger id="targetAccountId">
                  <SelectValue placeholder="Conta destino" />
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      <span className="ml-2 text-faint-foreground text-[11.5px]">
                        · {a.institution}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          <Field label="Notas (opcional)" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Saque mensal pra cobrir o aluguel, etc"
            />
          </Field>

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Sacando…" : "Registrar saque"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
