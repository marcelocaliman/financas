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
import { PillGroup } from "@/components/ui/pill-group";
import { Textarea } from "@/components/ui/textarea";
import {
  addMovement,
  updateMovement,
  type MovementFormState,
} from "@/services/movements.actions";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Tables } from "@/types/database";

type Investment = Tables<"investments">;
type Movement = Tables<"investment_movements">;
type ExtraKind = "exercise" | "assignment" | "expiration";

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function MovementDialog({
  open,
  onOpenChange,
  investment,
  defaultKind = "buy",
  movement,
  forceKind,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment: Investment;
  defaultKind?: "buy" | "sell";
  /** Quando passado, dialog entra em modo edição (prefill + updateMovement) */
  movement?: Movement | null;
  /** Força um kind específico (exercise/assignment/expiration pra opções) */
  forceKind?: ExtraKind;
}) {
  const isEdit = !!movement;
  const initialKind: "buy" | "sell" =
    movement && (movement.kind === "buy" || movement.kind === "sell")
      ? movement.kind
      : defaultKind;
  const initialQty = movement ? String(movement.quantity) : "";
  const initialUnitPrice = movement ? Number(movement.unit_price) : 0;
  const initialTotalAmount = movement ? Number(movement.total_amount ?? 0) : 0;
  const initialDate = movement?.date ?? todayISO();
  const initialFees = movement ? Number(movement.fees ?? 0) : 0;
  const initialNotes = movement?.notes ?? "";

  const [kind, setKind] = useState<"buy" | "sell">(initialKind);
  const [qty, setQty] = useState<string>(initialQty);
  const [unitPrice, setUnitPrice] = useState<number>(initialUnitPrice);
  const [totalAmount, setTotalAmount] = useState<number>(initialTotalAmount);
  const [lastTouched, setLastTouched] = useState<"unit" | "total">("unit");
  const [date, setDate] = useState(initialDate);

  const [state, action, pending] = useActionState<MovementFormState | undefined, FormData>(
    isEdit ? updateMovement : addMovement,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setKind(initialKind);
      setQty(initialQty);
      setUnitPrice(initialUnitPrice);
      setTotalAmount(initialTotalAmount);
      setLastTouched("unit");
      setDate(initialDate);
    }
  }

  function handleQtyChange(next: string) {
    setQty(next);
    const q = Number(next) || 0;
    if (lastTouched === "unit" && unitPrice > 0) {
      setTotalAmount(Math.round(q * unitPrice * 100) / 100);
    } else if (lastTouched === "total" && totalAmount > 0 && q > 0) {
      setUnitPrice(Math.round((totalAmount / q) * 10000) / 10000);
    }
  }
  function handleUnitChange(next: number) {
    setUnitPrice(next);
    setLastTouched("unit");
    const q = Number(qty) || 0;
    if (q > 0) setTotalAmount(Math.round(q * next * 100) / 100);
  }
  function handleTotalChange(next: number) {
    setTotalAmount(next);
    setLastTouched("total");
    const q = Number(qty) || 0;
    if (q > 0) setUnitPrice(Math.round((next / q) * 10000) / 10000);
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        isEdit
          ? "Movimento atualizado — preço médio recalculado."
          : kind === "buy"
            ? "Aporte registrado."
            : "Venda registrada.",
      );
      onOpenChange(false);
    }
  }, [state, onOpenChange, kind, isEdit]);

  const qtyNum = Number(qty) || 0;
  const total = totalAmount > 0 ? totalAmount : qtyNum * unitPrice;
  const currentQty = Number(investment.quantity ?? 0);
  const currentAvg = currentQty > 0 ? Number(investment.initial_amount) / currentQty : 0;

  // Preview do novo preço médio se for compra
  let newAvg = currentAvg;
  let newQty = currentQty;
  if (kind === "buy" && qtyNum > 0) {
    const newTotalCost = Number(investment.initial_amount) + total;
    newQty = currentQty + qtyNum;
    newAvg = newQty > 0 ? newTotalCost / newQty : 0;
  } else if (kind === "sell" && qtyNum > 0) {
    newQty = Math.max(0, currentQty - qtyNum);
  }

  const isCrypto = investment.asset_type === "crypto";
  const unit = isCrypto ? "unidades" : "cotas";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={`${investment.ticker} · ${isEdit ? "Editar lote" : kind === "buy" ? "Novo aporte" : "Venda"}`}
          title={
            isEdit
              ? "Editar movimento."
              : kind === "buy"
                ? "Registrar novo aporte."
                : "Registrar venda."
          }
          description={
            isEdit
              ? "Corrige os dados desse lote. O preço médio do ativo é recalculado automaticamente a partir do extrato completo."
              : kind === "buy"
                ? "Cada aporte vira um lote no extrato e recalcula seu preço médio."
                : "A venda remove cotas e o custo proporcional. Preço médio do que sobra fica intacto."
          }
        />
        <form action={action} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={movement.id} /> : null}
          <input type="hidden" name="investmentId" value={investment.id} />
          <input type="hidden" name="kind" value={forceKind ?? kind} />

          {isEdit ? (
            <div className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-faint-foreground">
              Tipo · <span className="text-foreground">{kind === "buy" ? "Compra" : "Venda"}</span>
              <span className="ml-2 text-faint-foreground normal-case tracking-normal">
                (não pode mudar — apague e crie um novo se necessário)
              </span>
            </div>
          ) : (
            <PillGroup
              options={[
                { value: "buy", label: "Comprar" },
                { value: "sell", label: "Vender" },
              ]}
              value={kind}
              onChange={(v) => setKind(v as "buy" | "sell")}
            />
          )}

          <Field label={`Quantidade (${unit})`} htmlFor="quantity" required>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="any"
              min="0"
              value={qty}
              onChange={(e) => handleQtyChange(e.target.value)}
              className="font-mono"
              autoFocus
            />
            {state?.fieldErrors?.quantity ? (
              <p className="text-[11.5px] text-rust-600 mt-1">
                {state.fieldErrors.quantity}
              </p>
            ) : null}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor aplicado (total)"
              htmlFor="totalAmount"
              hint="Quanto você gastou no agregado"
            >
              <MoneyInput
                key={`total-${lastTouched === "unit" ? totalAmount : "input"}`}
                name="totalAmount"
                id="totalAmount"
                defaultValue={totalAmount}
                onValueChange={handleTotalChange}
              />
            </Field>
            <Field label="Preço unitário" htmlFor="unitPrice" required>
              <MoneyInput
                key={`unit-${lastTouched === "total" ? unitPrice : "input"}`}
                name="unitPrice"
                id="unitPrice"
                defaultValue={unitPrice}
                onValueChange={handleUnitChange}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" htmlFor="date" required>
              <Input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Taxas (opcional)" htmlFor="fees" hint="Corretagem, custódia, IOF…">
              <MoneyInput name="fees" id="fees" defaultValue={initialFees} />
            </Field>
          </div>

          <Field label="Notas (opcional)" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} defaultValue={initialNotes} />
          </Field>

          {qtyNum > 0 && unitPrice > 0 ? (
            isEdit ? (
              <div className="rounded-[10px] border border-border bg-surface-muted px-4 py-3 text-[12.5px] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total deste lote</span>
                  <b className="text-foreground"><MoneyMask>{formatMoney(total)}</MoneyMask></b>
                </div>
                <p className="text-[11.5px] text-muted-foreground !mt-2 not-italic">
                  Quantidade total e preço médio do ativo serão recalculados a partir
                  do extrato completo após salvar.
                </p>
              </div>
            ) : (
              <div className="rounded-[10px] border border-border bg-surface-muted px-4 py-3 text-[12.5px] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total do lote</span>
                  <b className="text-foreground"><MoneyMask>{formatMoney(total)}</MoneyMask></b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantidade após</span>
                  <b className="text-foreground">
                    <MoneyMask>{newQty.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</MoneyMask> {unit}
                  </b>
                </div>
                {kind === "buy" && newAvg > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Novo preço médio</span>
                    <b className="text-foreground"><MoneyMask>{formatMoney(newAvg)}</MoneyMask> / {unit.slice(0, -1)}</b>
                  </div>
                ) : null}
                {kind === "sell" && currentQty > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resultado da venda</span>
                    <b
                      className={
                        total - currentAvg * qtyNum > 0
                          ? "text-olive-700 dark:text-olive-500"
                          : total - currentAvg * qtyNum < 0
                            ? "text-rust-600"
                            : "text-foreground"
                      }
                    >
                      {total - currentAvg * qtyNum >= 0 ? "+" : ""}
                      <MoneyMask>{formatMoney(total - currentAvg * qtyNum)}</MoneyMask>
                    </b>
                  </div>
                ) : null}
              </div>
            )
          ) : null}

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || qtyNum <= 0 || unitPrice <= 0}
            >
              {pending
                ? "Salvando…"
                : isEdit
                  ? "Salvar alterações"
                  : kind === "buy"
                    ? "Registrar aporte"
                    : "Registrar venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
