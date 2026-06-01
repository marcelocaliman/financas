"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, AlertTriangle, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { payCreditCardBill } from "@/services/credit-card.actions";

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Ações de uma fatura: "marcar como paga" (cria a transferência conta→cartão) e
 * reconciliação (digita o total da fatura do banco → confere com a soma dos
 * lançamentos). Resolve "saldo só cresce" e "será que bate com o banco?".
 */
export function BillActions({
  cardAccountId,
  amountDue,
  dueDate,
  isCurrent,
}: {
  cardAccountId: string;
  /** Valor a pagar (totalOpen − já pago). */
  amountDue: number;
  dueDate: string;
  /** Ciclo ainda em formação — só reconcilia, não paga. */
  isCurrent: boolean;
}) {
  const [pending, start] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState(amountDue);
  const [date, setDate] = useState(dueDate >= todayISO() ? dueDate : todayISO());

  // Reconciliação (sem persistir): compara o total do banco com a soma do app.
  const [bankText, setBankText] = useState("");
  const bankValue = bankText
    ? Number(bankText.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."))
    : null;
  const diff = bankValue != null && Number.isFinite(bankValue) ? Math.round((bankValue - amountDue) * 100) / 100 : null;

  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5">
      {/* Reconciliação */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Scale className="w-3.5 h-3.5" strokeWidth={1.7} />
          Confere com o banco:
        </span>
        <Input
          value={bankText}
          onChange={(e) => setBankText(e.target.value)}
          placeholder="total da fatura"
          inputMode="decimal"
          className="h-8 w-36 text-[13px]"
        />
        {diff != null ? (
          Math.abs(diff) < 0.01 ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-olive-700 dark:text-olive-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              Bate certinho
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] text-gold-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} />
              {diff > 0 ? "Faltam" : "Sobram"} R$ {fmtBRL(Math.abs(diff))} no app
            </span>
          )
        ) : null}
      </div>

      {/* Marcar como paga */}
      {!isCurrent && amountDue > 0.01 ? (
        payOpen ? (
          <div className="flex items-end gap-2 flex-wrap rounded-[8px] bg-surface-muted/50 p-2.5">
            <label className="text-[11px] text-muted-foreground">
              Valor pago
              <div className="mt-0.5 w-32">
                <MoneyInput name="payAmount" value={amount} onValueChange={setAmount} />
              </div>
            </label>
            <label className="text-[11px] text-muted-foreground">
              Data
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 mt-0.5 w-[150px] text-[13px]"
              />
            </label>
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await payCreditCardBill({ cardAccountId, amount, date });
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Pagamento registrado.");
                    setPayOpen(false);
                  }
                })
              }
            >
              <Check className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
              Confirmar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPayOpen(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setPayOpen(true)}>
            <Check className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
            Marcar como paga
          </Button>
        )
      ) : null}
    </div>
  );
}
