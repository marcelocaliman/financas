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
import { Textarea } from "@/components/ui/textarea";
import { recordGoalContribution } from "@/services/goals.actions";
import type { Currency } from "@/types/database";

/**
 * Diálogo "Aportar na meta" — registra uma linha em goal_contributions
 * (histórico) e soma no current_amount (snapshot). Quando a meta tem fontes
 * vinculadas, o current_amount funciona como "bônus" — soma com o earmark live.
 */
export function ContributeDialog({
  open,
  onOpenChange,
  goalId,
  goalName,
  goalCurrency,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goalId: string;
  goalName: string;
  goalCurrency: Currency;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (amount <= 0) {
      toast.error("Informe um valor positivo.");
      return;
    }
    startTransition(async () => {
      const r = await recordGoalContribution(goalId, amount, {
        date,
        source: "manual",
        notes: notes.trim() || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Aporte de ${formatCurrency(amount, goalCurrency)} registrado.`);
      onOpenChange(false);
      setAmount(0);
      setNotes("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow="Aportar na meta"
          title={
            <>
              Aporte em <em className="italic">{goalName}</em>
            </>
          }
          description="Registra a contribuição no histórico e atualiza o progresso da meta na hora."
        />

        <div className="space-y-4">
          <Field label={`Valor (${goalCurrency})`} htmlFor="contrib-amount" required>
            <MoneyInput
              id="contrib-amount"
              name="amount"
              currency={goalCurrency}
              defaultValue={amount}
              onValueChange={setAmount}
              size="lg"
              autoFocus
            />
          </Field>

          <Field label="Data" htmlFor="contrib-date">
            <Input
              id="contrib-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Notas (opcional)" htmlFor="contrib-notes">
            <Textarea
              id="contrib-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aporte mensal, bônus, restituição IR…"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={pending || amount <= 0}>
            {pending ? "Registrando…" : "Registrar aporte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}
