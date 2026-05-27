"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { formatMoney } from "@/lib/utils/format";
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
  const [amount, setAmount] = useState<number>(0);

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
      setAmount(0);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      const fy = state.fromYield ?? 0;
      const pr = state.principalReduction ?? 0;
      toast.success(
        `Saque registrado · R$ ${formatMoney(fy)} de rendimento + R$ ${formatMoney(pr)} de custo (proporcional).`,
      );
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const currentBalance = Number(investment.current_balance ?? 0);
  const accYield = Math.max(0, accumulatedYield);

  // Preview proporcional (TD-style): saque divide entre yield/custo na mesma
  // proporção que eles ocupam no saldo. Saldo final reduz proporcionalmente.
  const ratio = currentBalance > 0 ? Math.min(amount, currentBalance) / currentBalance : 0;
  const previewFromYield = currentBalance > 0 ? (accYield / currentBalance) * amount : 0;
  const previewPrincipalReduction =
    currentBalance > 0 ? ((currentBalance - accYield) / currentBalance) * amount : 0;
  // Warning: saque maior que rendimento acumulado = está reduzindo capital
  // além do que ganhou
  const exceededYield = amount > accYield + 0.005;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={`Sacar · ${investment.ticker}`}
          title="Sacar do ativo."
          description="Venda parcial proporcional (modelo Tesouro Direto): rendimento e custo de aquisição reduzem na mesma fração da posição vendida. Rentabilidade % preservada."
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
            hint="A posição reduz proporcionalmente. Acima do rendimento acumulado: você diminui capital além dos ganhos (alerta)."
          >
            <MoneyInput
              name="amount"
              id="amount"
              size="lg"
              defaultValue={amount}
              onValueChange={setAmount}
              autoFocus
            />
            {state?.fieldErrors?.amount ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.amount}</p>
            ) : null}
          </Field>

          {/* Preview proporcional + warning quando saque > rendimento */}
          {amount > 0 ? (
            <div
              className={
                "rounded-[10px] px-4 py-3 text-[12.5px] " +
                (exceededYield
                  ? "bg-rust-100/40 dark:bg-rust-700/15 border border-rust-600/30"
                  : "bg-olive-50 dark:bg-olive-700/10 border border-olive-600/25")
              }
            >
              {exceededYield ? (
                <div className="flex items-start gap-2 text-rust-600 mb-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.7} />
                  <b>Saque maior que o rendimento acumulado — está reduzindo capital além dos ganhos.</b>
                </div>
              ) : null}
              <div className="font-mono space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vende {(ratio * 100).toFixed(2).replace(".", ",")}% da posição</span>
                  <span className="text-foreground tabular-nums">R$ {formatMoney(amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">→ parte que é rendimento</span>
                  <span className="text-olive-700 dark:text-olive-500 tabular-nums">
                    R$ {formatMoney(previewFromYield)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">→ parte que é custo (initial reduz)</span>
                  <span className="text-navy-700 dark:text-navy-300 tabular-nums">
                    R$ {formatMoney(previewPrincipalReduction)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1 mt-1">
                  <span className="text-faint-foreground">Rentabilidade % preservada</span>
                  <span className="text-faint-foreground tabular-nums">✓</span>
                </div>
              </div>
            </div>
          ) : null}

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
            <Button
              type="submit"
              variant={exceededYield ? "danger" : "primary"}
              disabled={pending || amount <= 0}
            >
              {pending
                ? "Sacando…"
                : exceededYield
                  ? "Sacar reduzindo capital"
                  : "Registrar saque"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
