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
import { MoneyInput } from "@/components/ui/money-input";
import {
  executeRedemption,
  skipRedemption,
} from "@/services/redemptions.actions";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

export function IntentActions({
  intentId,
  suggestedAmount,
  investmentName,
  destinationName,
  dueLabel,
}: {
  intentId: string;
  suggestedAmount: number;
  investmentName: string;
  destinationName: string;
  dueLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggestedAmount);

  const handleExecute = () => {
    startTransition(async () => {
      const r = await executeRedemption(intentId, amount);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Saque registrado e par espelhado criado.");
        setOpen(false);
      }
    });
  };

  const handleSkip = () => {
    if (!confirm(`Pular o saque de ${dueLabel}? Pode retomar no próximo.`)) return;
    startTransition(async () => {
      const r = await skipRedemption(intentId);
      if (r.error) toast.error(r.error);
      else toast.success("Saque pulado esse mês.");
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={pending} onClick={() => setOpen(true)}>
          Confirmar <MoneyMask>{formatMoney(suggestedAmount)}</MoneyMask>
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={handleSkip}>
          Pular esse mês
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader
            eyebrow={`Saque · ${dueLabel}`}
            title="Confirmar saque."
            description={`${investmentName} → ${destinationName}. Ajuste o valor se precisar.`}
          />
          <Field label="Valor a sacar" htmlFor="amount">
            <MoneyInput
              name="amount"
              id="amount"
              defaultValue={suggestedAmount}
              onValueChange={setAmount}
              autoFocus
              size="lg"
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={pending || amount <= 0}
              onClick={handleExecute}
            >
              {pending ? "Registrando…" : "Confirmar saque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
