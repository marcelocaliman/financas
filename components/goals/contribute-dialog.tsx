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
import {
  recordGoalContribution,
  recordGoalWithdrawal,
} from "@/services/goals.actions";
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

type DialogMode = "deposit" | "withdraw";

/**
 * Diálogo "Aportar / Retirar da meta".
 *
 * Quando a meta tem fonte do tipo conta vinculada (linkedAccounts não vazio):
 *
 *   APORTAR:  user escolhe Conta Origem (qualquer) → Destino é a fonte
 *             vinculada. create_transfer move o dinheiro. Earmark sobe.
 *   RETIRAR:  Origem é a fonte vinculada → user escolhe Destino (qualquer
 *             outra conta sua). create_transfer move o dinheiro. Earmark cai.
 *
 * Sem fontes vinculadas (ou se escolher "simbólico"): só registra no
 * histórico (positivo no aporte, negativo na retirada) + ajusta current_amount.
 *
 * Limite de retirada: amount ≤ maxWithdrawable (= derivedCurrent da meta).
 * Bloqueio defensivo no servidor também.
 */
export function ContributeDialog({
  open,
  onOpenChange,
  goalId,
  goalName,
  goalCurrency,
  mode = "deposit",
  accounts = [],
  linkedAccounts = [],
  maxWithdrawable,
  defaultAmount,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goalId: string;
  goalName: string;
  goalCurrency: Currency;
  /** "deposit" (Aportar) ou "withdraw" (Retirar) */
  mode?: DialogMode;
  /** Todas as contas do household. Vazio = só modo simbólico. */
  accounts?: ContributeAccountOption[];
  /**
   * Contas que são fonte vinculada da meta. Vazio = só modo simbólico.
   * No deposit estas são opções de DESTINO. No withdraw são opções de ORIGEM.
   */
  linkedAccounts?: ContributeDestinationOption[];
  /** Só usado em withdraw. Bloqueia amount > este valor. */
  maxWithdrawable?: number;
  /** Pré-preenche o campo "Valor". Default = 0. */
  defaultAmount?: number;
  /** Pré-preenche o campo "Data" (ISO YYYY-MM-DD). Default = hoje. */
  defaultDate?: string;
}) {
  const isWithdraw = mode === "withdraw";
  const [amount, setAmount] = useState<number>(defaultAmount ?? 0);
  const [date, setDate] = useState<string>(defaultDate ?? todayISO());
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  // Reset de campos quando o dialog reabre (com defaults novos)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAmount(defaultAmount ?? 0);
      setDate(defaultDate ?? todayISO());
      setNotes("");
    }
  }

  const hasLinked = linkedAccounts.length > 0;
  const defaultLinked = hasLinked ? linkedAccounts[0].accountId : SYMBOLIC_VALUE;
  // No deposit: linkedId = destino. No withdraw: linkedId = origem.
  const [linkedId, setLinkedId] = useState<string>(defaultLinked);
  // A "outra ponta" — destino no withdraw, origem no deposit.
  const [otherAccountId, setOtherAccountId] = useState<string>("");

  const isSymbolic = linkedId === SYMBOLIC_VALUE;

  // Outra conta não pode ser igual à vinculada
  const otherOptions = useMemo(
    () => (isSymbolic ? accounts : accounts.filter((a) => a.id !== linkedId)),
    [accounts, linkedId, isSymbolic],
  );

  const overMax =
    isWithdraw && maxWithdrawable != null && amount > maxWithdrawable + 0.005;

  const labels = isWithdraw
    ? {
        eyebrow: "Retirar da meta",
        title: (
          <>
            Retirar de <em className="italic">{goalName}</em>
          </>
        ),
        description: hasLinked
          ? "Saca da conta vinculada e manda pra outra conta sua. Saldos das duas se ajustam automaticamente."
          : "Registra a retirada no histórico e diminui o saldo da meta.",
        linkedFieldLabel: "Origem (fonte vinculada)",
        otherFieldLabel: "Conta de destino",
        otherPlaceholder: "Pra onde vai o dinheiro?",
        symbolicLabel: "Apenas registrar (sem mover dinheiro)",
        successSymbolic: (v: string) => `Retirada de ${v} registrada.`,
        successTransfer: (v: string) => `Retirada de ${v} feita e registrada.`,
        confirmLabel: "Retirar e registrar",
        confirmLabelSymbolic: "Registrar retirada",
        loadingLabel: "Retirando…",
      }
    : {
        eyebrow: "Aportar na meta",
        title: (
          <>
            Aporte em <em className="italic">{goalName}</em>
          </>
        ),
        description: hasLinked
          ? "Move o dinheiro da conta de origem pra fonte vinculada da meta. Saldos das duas contas se ajustam automaticamente."
          : "Registra a contribuição simbólica no histórico (esta meta não tem conta vinculada como fonte).",
        linkedFieldLabel: "Destino (fonte vinculada)",
        otherFieldLabel: "Conta de origem",
        otherPlaceholder: "De onde sai o dinheiro?",
        symbolicLabel: "Apenas registrar (sem mover dinheiro)",
        successSymbolic: (v: string) => `Aporte de ${v} registrado.`,
        successTransfer: (v: string) =>
          `Transferência de ${v} feita e aporte registrado.`,
        confirmLabel: "Transferir e registrar",
        confirmLabelSymbolic: "Registrar aporte",
        loadingLabel: "Registrando…",
      };

  const handleSubmit = () => {
    if (amount <= 0) {
      toast.error("Informe um valor positivo.");
      return;
    }
    if (overMax) {
      toast.error(
        `Valor maior que o saldo da meta (${formatCurrency(maxWithdrawable!, goalCurrency)}).`,
      );
      return;
    }
    if (!isSymbolic && !otherAccountId) {
      toast.error(
        isWithdraw
          ? "Escolha a conta de destino."
          : "Escolha a conta de origem do aporte.",
      );
      return;
    }
    startTransition(async () => {
      const transferOpts = !isSymbolic
        ? isWithdraw
          ? { fromAccountId: linkedId, toAccountId: otherAccountId }
          : { fromAccountId: otherAccountId, toAccountId: linkedId }
        : {};
      const r = isWithdraw
        ? await recordGoalWithdrawal(goalId, amount, {
            date,
            notes: notes.trim() || undefined,
            ...transferOpts,
          })
        : await recordGoalContribution(goalId, amount, {
            date,
            notes: notes.trim() || undefined,
            ...transferOpts,
          });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const valueStr = formatCurrency(amount, goalCurrency);
      toast.success(
        isSymbolic ? labels.successSymbolic(valueStr) : labels.successTransfer(valueStr),
      );
      onOpenChange(false);
      setAmount(0);
      setNotes("");
      setOtherAccountId("");
      setLinkedId(defaultLinked);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={labels.eyebrow}
          title={labels.title}
          description={labels.description}
        />

        <div className="space-y-4">
          <Field label={`Valor (${goalCurrency})`} htmlFor="contrib-amount" required>
            <MoneyInput
              // key força remount quando o defaultAmount muda (ex: dialog reabre
              // pra outra meta com valor sugerido diferente) — MoneyInput é
              // uncontrolled, só lê defaultValue no mount.
              key={`amt-${defaultAmount ?? 0}-${open ? "o" : "c"}`}
              id="contrib-amount"
              name="amount"
              currency={goalCurrency}
              defaultValue={amount}
              onValueChange={setAmount}
              size="lg"
              autoFocus
            />
            {isWithdraw && maxWithdrawable != null ? (
              <div
                className={
                  "mt-1.5 font-mono text-[11px] " +
                  (overMax ? "text-rust-600" : "text-faint-foreground")
                }
              >
                {overMax ? "Acima do saldo. " : "Disponível: "}
                {formatCurrency(maxWithdrawable, goalCurrency)}
              </div>
            ) : null}
          </Field>

          {hasLinked ? (
            <Field label={labels.linkedFieldLabel} htmlFor="contrib-linked" required>
              <Select value={linkedId} onValueChange={setLinkedId}>
                <SelectTrigger id="contrib-linked">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {linkedAccounts.map((d) => (
                    <SelectItem key={d.accountId} value={d.accountId}>
                      {d.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={SYMBOLIC_VALUE}>{labels.symbolicLabel}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {!isSymbolic ? (
            <Field label={labels.otherFieldLabel} htmlFor="contrib-other" required>
              <Select value={otherAccountId} onValueChange={setOtherAccountId}>
                <SelectTrigger id="contrib-other">
                  <SelectValue placeholder={labels.otherPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {otherOptions.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Nenhuma conta disponível
                    </SelectItem>
                  ) : (
                    otherOptions.map((a) => (
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
              placeholder={
                isWithdraw
                  ? "Imprevisto, mudança de plano, troca de meta…"
                  : "Aporte mensal, bônus, restituição IR…"
              }
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={isWithdraw ? "outline" : "primary"}
            onClick={handleSubmit}
            disabled={pending || amount <= 0 || overMax || (!isSymbolic && !otherAccountId)}
            className={
              isWithdraw
                ? "border-rust-600/40 text-rust-600 hover:bg-rust-600/10"
                : undefined
            }
          >
            {pending
              ? labels.loadingLabel
              : isSymbolic
                ? labels.confirmLabelSymbolic
                : labels.confirmLabel}
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
