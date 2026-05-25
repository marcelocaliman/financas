"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransaction } from "@/services/transactions.actions";

type AccountLite = { id: string; name: string; institution: string };

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthYearLabel(d: Date): string {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${months[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

/**
 * Atalho otimizado pra lançar a FATURA TOTAL do cartão de crédito.
 * Caso de uso comum: usuário não detalha cada gasto, lança 1 transaction
 * mensal "Fatura cartão XP — mai/26" com o valor consolidado.
 */
export function CreditCardBillShortcut({ accounts }: { accounts: AccountLite[] }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(todayISO());
  const [pending, startTransition] = useTransition();

  const billLabel = (() => {
    const d = new Date(date + "T00:00:00Z");
    // Fatura do mês anterior (vencendo no mês atual)
    const ref = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
    return monthYearLabel(ref);
  })();

  const handleSubmit = () => {
    if (!accountId || amount <= 0) {
      toast.error("Selecione a conta e informe o valor.");
      return;
    }
    const fd = new FormData();
    fd.set("kind", "expense");
    fd.set("amount", String(amount));
    fd.set("description", `Fatura cartão — ${billLabel}`);
    fd.set("accountId", accountId);
    fd.set("date", date);
    fd.set("paymentMethod", "credit");

    startTransition(async () => {
      const r = await createTransaction(undefined, fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Fatura ${billLabel} lançada (R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`);
      setOpen(false);
      setAmount(0);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium tracking-[-0.005em] border border-border bg-surface hover:bg-surface-muted text-foreground transition-colors"
        title="Atalho: lança 1 transaction única com o valor total da fatura do mês."
      >
        <CreditCard className="w-3.5 h-3.5" strokeWidth={1.7} />
        Lançar fatura
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader
            eyebrow="Atalho"
            title={
              <>
                <CreditCard className="inline w-4 h-4 mr-2 -mt-0.5" strokeWidth={1.8} />
                Lançar fatura do cartão.
              </>
            }
            description={`Cria 1 despesa única "Fatura cartão — ${billLabel}". Use quando você não quer detalhar cada compra individual.`}
          />

          <div className="space-y-4">
            <Field htmlFor="bill-amount" label="Valor total da fatura" required>
              <MoneyInput
                name="bill-amount"
                id="bill-amount"
                defaultValue={amount}
                onValueChange={setAmount}
                size="lg"
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Conta de débito" htmlFor="bill-account" required>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="bill-account">
                    <SelectValue placeholder="Conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data do pagamento" htmlFor="bill-date">
                <Input
                  id="bill-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="button" onClick={handleSubmit} disabled={pending}>
              {pending ? "Lançando…" : "Lançar fatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
