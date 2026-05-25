"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleDollarSign, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
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
import { liquidateInvestment } from "@/services/investments.actions";
import type { Tables } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string };
type Investment = Tables<"investments"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
};

const REASONS = [
  { value: "sold", label: "Vendido (antes do vencimento)" },
  { value: "matured", label: "Vencido (chegou ao vencimento natural)" },
  { value: "archived", label: "Encerrado sem venda formal" },
] as const;

/** Tabela regressiva IR renda fixa pública/privada (dias × alíquota) */
function suggestIRRate(holdingDays: number): number {
  if (holdingDays <= 180) return 0.225;
  if (holdingDays <= 360) return 0.20;
  if (holdingDays <= 720) return 0.175;
  return 0.15;
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function LiquidateInvestmentDialog({
  open,
  onOpenChange,
  investment,
  destinationAccounts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment: Investment;
  destinationAccounts: AccountLite[];
}) {
  const [date, setDate] = useState<string>(todayISO());
  const [gross, setGross] = useState<number>(Number(investment.current_balance ?? 0));
  const [ir, setIr] = useState<number>(0);
  const [reason, setReason] = useState<"sold" | "matured" | "archived">("sold");
  const [destAccountId, setDestAccountId] = useState<string>(
    destinationAccounts[0]?.id ?? "",
  );
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const initial = Number(investment.initial_amount ?? 0);
  const grossGain = Math.max(0, gross - initial);

  // Sugestão de IR baseada no holding period (só pra renda fixa)
  const irSuggestion = useMemo(() => {
    if (!investment.purchase_date || !date) return null;
    const purchase = new Date(investment.purchase_date + "T00:00:00Z");
    const sale = new Date(date + "T00:00:00Z");
    const days = Math.max(0, Math.floor((sale.getTime() - purchase.getTime()) / 86400000));
    const isFixedIncome =
      investment.asset_type === "fixed_income_public" ||
      investment.asset_type === "fixed_income_private";
    if (!isFixedIncome) return null;
    const rate = suggestIRRate(days);
    return { days, rate, value: Math.round(grossGain * rate * 100) / 100 };
  }, [investment.purchase_date, investment.asset_type, date, grossGain]);

  const net = gross - ir;

  const handleSubmit = () => {
    if (!date) {
      toast.error("Informe a data da operação.");
      return;
    }
    if (gross < 0) {
      toast.error("Valor recebido inválido.");
      return;
    }
    startTransition(async () => {
      const r = await liquidateInvestment({
        investmentId: investment.id,
        date,
        grossProceeds: gross,
        irWithheld: ir,
        destinationAccountId: destAccountId || null,
        reason,
        notes: notes || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        reason === "sold"
          ? "Venda registrada."
          : reason === "matured"
            ? "Vencimento registrado."
            : "Investimento encerrado.",
      );
      onOpenChange(false);
    });
  };

  const applySuggestion = () => {
    if (irSuggestion) setIr(irSuggestion.value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow="Liquidar investimento"
          title={
            <>
              <CircleDollarSign className="inline w-4 h-4 mr-2 -mt-0.5" strokeWidth={1.8} />
              Encerrar <em className="not-italic font-display italic">{investment.ticker}</em>.
            </>
          }
          description="Registra venda/vencimento, calcula IR, lança o líquido na conta destino e arquiva o ativo. Reversível pela ação 'Reabrir'."
        />

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da operação" htmlFor="date" required>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Motivo" htmlFor="reason" required>
              <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor BRUTO recebido"
              htmlFor="gross"
              hint={`Aplicado: R$ ${initial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              required
            >
              <MoneyInput
                id="gross"
                name="gross"
                defaultValue={gross}
                onValueChange={(v) => setGross(v)}
                size="lg"
              />
            </Field>
            <Field
              label="IR retido na fonte"
              htmlFor="ir"
              hint={
                irSuggestion
                  ? `Sugestão: ${(irSuggestion.rate * 100).toFixed(1)}% × R$ ${grossGain.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} = R$ ${irSuggestion.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${irSuggestion.days} dias)`
                  : "Confira no extrato/informe da corretora"
              }
            >
              <MoneyInput
                id="ir"
                name="ir"
                defaultValue={ir}
                onValueChange={(v) => setIr(v)}
              />
              {irSuggestion && Math.abs(ir - irSuggestion.value) > 0.01 ? (
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="mt-1 text-[11px] text-navy-700 dark:text-navy-300 hover:underline"
                >
                  Aplicar sugestão (R$ {irSuggestion.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                </button>
              ) : null}
            </Field>
          </div>

          <div className="rounded-[8px] border border-border bg-surface-muted/40 px-4 py-3">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted-foreground">Ganho bruto</span>
              <span className="font-mono tabular-nums">R$ {grossGain.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px] mt-1">
              <span className="text-muted-foreground">IR retido</span>
              <span className="font-mono tabular-nums text-rust-600">− R$ {ir.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between text-[14px] mt-2 pt-2 border-t border-border">
              <span className="font-medium">
                <ArrowDownToLine className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" strokeWidth={1.8} />
                Líquido na conta destino
              </span>
              <span className="font-mono tabular-nums font-semibold text-olive-700 dark:text-olive-500">
                R$ {net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <Field
            label="Conta destino do caixa"
            htmlFor="destAccount"
            hint="Opcional — deixar vazio se você ainda não decidiu onde aplicar"
          >
            <Select
              value={destAccountId || "none"}
              onValueChange={(v) => setDestAccountId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="destAccount">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— sem destino (só registra venda)</SelectItem>
                {destinationAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.institution}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Notas" htmlFor="notes" hint="Opcional">
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: vendido pra migrar pro Selic 2031…"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={pending}>
            {pending ? "Salvando…" : "Confirmar liquidação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
