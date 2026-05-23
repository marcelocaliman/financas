"use client";

import { useMemo, useState, useTransition } from "react";
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
import { recordGoalContribution } from "@/services/goals.actions";
import type { Currency } from "@/types/database";

const SYMBOLIC_VALUE = "__symbolic__";

export type ContributeAccountOption = {
  id: string;
  name: string;
  institution: string;
};

export type ContributeDestinationOption = {
  accountId: string;
  label: string; // ex: "Itaú · CC · Reserva (fonte vinculada)"
};

/**
 * Diálogo "Aportar na meta".
 *
 * Quando a meta tem fontes do tipo conta vinculadas, vc pode escolher:
 *  - Conta origem (de onde o dinheiro sai)
 *  - Conta destino (uma das fontes da meta)
 *  → Cria uma transferência REAL via create_transfer (debita origem, credita
 *    destino). O earmark da meta sobe naturalmente pq o saldo da fonte subiu.
 *
 * Sem destino vinculado (ou se o usuário escolher "simbólico"), o aporte
 * apenas registra a contribuição + soma no current_amount (snapshot).
 */
export function ContributeDialog({
  open,
  onOpenChange,
  goalId,
  goalName,
  goalCurrency,
  accounts = [],
  destinationAccounts = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goalId: string;
  goalName: string;
  goalCurrency: Currency;
  /** Todas as contas do household (candidatas a origem). Vazio = só modo simbólico. */
  accounts?: ContributeAccountOption[];
  /** Apenas as contas que são fonte vinculada da meta (candidatas a destino). Vazio = só modo simbólico. */
  destinationAccounts?: ContributeDestinationOption[];
}) {
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const hasLinkedDestinations = destinationAccounts.length > 0;
  const defaultDestination = hasLinkedDestinations
    ? destinationAccounts[0].accountId
    : SYMBOLIC_VALUE;
  const [destinationId, setDestinationId] = useState<string>(defaultDestination);
  const [fromAccountId, setFromAccountId] = useState<string>("");

  const isSymbolic = destinationId === SYMBOLIC_VALUE;

  // Origem não pode ser igual ao destino (filtra na lista)
  const sourceOptions = useMemo(
    () => (isSymbolic ? accounts : accounts.filter((a) => a.id !== destinationId)),
    [accounts, destinationId, isSymbolic],
  );

  const handleSubmit = () => {
    if (amount <= 0) {
      toast.error("Informe um valor positivo.");
      return;
    }
    if (!isSymbolic && !fromAccountId) {
      toast.error("Escolha a conta de origem do aporte.");
      return;
    }
    startTransition(async () => {
      const r = await recordGoalContribution(goalId, amount, {
        date,
        notes: notes.trim() || undefined,
        fromAccountId: !isSymbolic ? fromAccountId : undefined,
        toAccountId: !isSymbolic ? destinationId : undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const successMsg = isSymbolic
        ? `Aporte de ${formatCurrency(amount, goalCurrency)} registrado.`
        : `Transferência de ${formatCurrency(amount, goalCurrency)} feita e aporte registrado.`;
      toast.success(successMsg);
      onOpenChange(false);
      setAmount(0);
      setNotes("");
      setFromAccountId("");
      setDestinationId(defaultDestination);
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
          description={
            hasLinkedDestinations
              ? "Move o dinheiro da conta de origem pra fonte vinculada da meta. Saldos das duas contas se ajustam automaticamente."
              : "Registra a contribuição simbólica no histórico (esta meta não tem conta vinculada como fonte)."
          }
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

          {hasLinkedDestinations ? (
            <Field label="Destino" htmlFor="contrib-destination" required>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger id="contrib-destination">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts.map((d) => (
                    <SelectItem key={d.accountId} value={d.accountId}>
                      {d.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={SYMBOLIC_VALUE}>
                    Apenas registrar (sem mover dinheiro)
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {!isSymbolic ? (
            <Field label="Conta de origem" htmlFor="contrib-from" required>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger id="contrib-from">
                  <SelectValue placeholder="De onde sai o dinheiro?" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Nenhuma conta disponível
                    </SelectItem>
                  ) : (
                    sourceOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.institution}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

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
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={pending || amount <= 0 || (!isSymbolic && !fromAccountId)}
          >
            {pending
              ? "Registrando…"
              : isSymbolic
                ? "Registrar aporte"
                : "Transferir e registrar"}
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
