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
import { applyIr, daysBetween } from "@/lib/financial/tax";
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
      const ir = state.irWithheld ?? 0;
      const net = state.netAmount ?? 0;
      toast.success(
        ir > 0
          ? `Saque líquido de ${formatMoney(net)} na conta · IR retido na fonte ${formatMoney(ir)}.`
          : `Saque de ${formatMoney(net)} registrado.`,
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

  // IR retido na fonte (renda fixa regressiva): sobre o RENDIMENTO. Isento
  // (LCI/LCA) e renda variável → 0. Espelha a action withdrawYield.
  const withholds =
    (investment.asset_type === "fixed_income_public" ||
      investment.asset_type === "fixed_income_private") &&
    investment.tax_regime === "regressive";
  const daysHeld = investment.purchase_date ? daysBetween(investment.purchase_date, date) : 0;
  const { tax: previewIr, rate: previewIrRate } = withholds
    ? applyIr(previewFromYield, daysHeld, "regressive")
    : { tax: 0, rate: 0 };
  const previewNet = amount - previewIr;

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
            hint="O dinheiro sai do montante total do ativo. A divisão rendimento/principal (abaixo) é só pra calcular o IR — só o rendimento é tributado."
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
                  ? "bg-gold-50 dark:bg-gold-700/10 border border-gold-600/30"
                  : "bg-olive-50 dark:bg-olive-700/10 border border-olive-600/25")
              }
            >
              {exceededYield ? (
                <div className="flex items-start gap-2 text-gold-700 dark:text-gold-500 mb-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.7} />
                  <span>
                    Saque maior que tudo que o ativo já rendeu ({formatMoney(accYield)}) — além
                    dos juros, você está resgatando parte do principal. Não muda o IR; é só pra
                    você saber que está consumindo o montante, não só os ganhos.
                  </span>
                </div>
              ) : null}
              <div className="font-mono space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Sai do montante ({(ratio * 100).toFixed(2).replace(".", ",")}% da posição)
                  </span>
                  <span className="text-foreground tabular-nums">{formatMoney(amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">↳ rendimento (tributável no IR)</span>
                  <span className="text-olive-700 dark:text-olive-500 tabular-nums">
                    {formatMoney(previewFromYield)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">↳ principal (devolução, isento)</span>
                  <span className="text-navy-700 dark:text-navy-300 tabular-nums">
                    {formatMoney(previewPrincipalReduction)}
                  </span>
                </div>
                {withholds && previewIr > 0 ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        IR retido na fonte ({(previewIrRate * 100).toFixed(1).replace(".", ",")}% sobre o rendimento)
                      </span>
                      <span className="text-rust-600 tabular-nums">− {formatMoney(previewIr)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/40 pt-1 mt-1 font-medium">
                      <span className="text-foreground">Líquido na conta</span>
                      <span className="text-foreground tabular-nums">{formatMoney(previewNet)}</span>
                    </div>
                  </>
                ) : (
                  <div className="border-t border-border/40 pt-1 mt-1 text-[11.5px] text-faint-foreground leading-snug">
                    O saque inteiro sai do montante. A divisão acima é só pra calcular o IR —
                    só o rendimento é tributado.
                  </div>
                )}
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
              variant="primary"
              disabled={pending || amount <= 0}
            >
              {pending ? "Sacando…" : "Registrar saque"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
