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
import { syncBrokerBalance } from "@/services/investments.actions";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Tables } from "@/types/database";

type Investment = Tables<"investments">;

/**
 * Dialog pra atualizar o current_balance e (opcionalmente) o purchase_date
 * com o valor REAL vindo do broker (Tesouro Direto, app do banco, etc).
 *
 * Override direto — elimina drift acumulado por bug de cálculo automático.
 * Usado quando o saldo exibido divergir do que o broker mostra.
 */
export function SyncBrokerBalanceDialog({
  open,
  onOpenChange,
  investment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment: Investment;
}) {
  const current = Number(investment.current_balance);
  const initial = Number(investment.initial_amount);
  const [newBalance, setNewBalance] = useState(current);
  const [updatePurchaseDate, setUpdatePurchaseDate] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(investment.purchase_date);

  const [state, action, pending] = useActionState<
    { ok?: boolean; error?: string } | undefined,
    FormData
  >(syncBrokerBalance, undefined);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setNewBalance(current);
      setUpdatePurchaseDate(false);
      setPurchaseDate(investment.purchase_date);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success("Saldo sincronizado com o broker.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const delta = newBalance - current;
  const newYield = newBalance - initial;
  const oldYield = current - initial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={`${investment.ticker} · Sincronizar com broker`}
          title="Atualizar saldo real."
          description="Cola o valor exato que aparece no Tesouro Direto / app do banco. Vira o baseline pro cálculo daqui pra frente."
        />
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={investment.id} />
          {updatePurchaseDate && purchaseDate ? (
            <input type="hidden" name="purchaseDate" value={purchaseDate} />
          ) : null}

          <Field
            label="Saldo atual (posição no broker)"
            htmlFor="currentBalance"
            required
            hint="Cole exatamente o número que aparece na sua corretora — sem mexer em decimais."
          >
            <MoneyInput
              name="currentBalance"
              id="currentBalance"
              defaultValue={current}
              onValueChange={setNewBalance}
              autoFocus
              size="lg"
            />
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px] text-muted-foreground bg-bone-100 dark:bg-ink-800 border border-border rounded-[8px] px-3 py-2.5">
            <input
              type="checkbox"
              checked={updatePurchaseDate}
              onChange={(e) => setUpdatePurchaseDate(e.target.checked)}
              className="mt-0.5 accent-navy-700"
            />
            <span>
              <b className="text-foreground">Atualizar a data real de compra</b>
              <br />
              <span className="text-[11.5px]">
                Atualmente: <b>{investment.purchase_date}</b>. Se for placeholder, marque
                pra setar a data correta — usada pra cálculo histórico.
              </span>
            </span>
          </label>

          {updatePurchaseDate ? (
            <Field label="Data real de compra" htmlFor="purchaseDate">
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </Field>
          ) : null}

          <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[12.5px] font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo antes</span>
              <b className="text-foreground">
                <MoneyMask>{formatMoney(current)}</MoneyMask>
              </b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo novo (broker)</span>
              <b className="text-foreground">
                <MoneyMask>{formatMoney(newBalance)}</MoneyMask>
              </b>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="text-muted-foreground">Δ</span>
              <b
                className={
                  delta > 0
                    ? "text-olive-700 dark:text-olive-500"
                    : delta < 0
                      ? "text-rust-600"
                      : "text-muted-foreground"
                }
              >
                {delta >= 0 ? "+" : ""}
                <MoneyMask>{formatMoney(delta)}</MoneyMask>
              </b>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-[11.5px]">
              <span className="text-faint-foreground">Rendimento (antes)</span>
              <span className="text-faint-foreground tabular-nums">
                <MoneyMask>{formatMoney(oldYield)}</MoneyMask>
              </span>
            </div>
            <div className="flex justify-between text-[11.5px]">
              <span className="text-faint-foreground">Rendimento (depois)</span>
              <span
                className={`tabular-nums ${
                  newYield > 0
                    ? "text-olive-700 dark:text-olive-500"
                    : newYield < 0
                      ? "text-rust-600"
                      : "text-faint-foreground"
                }`}
              >
                <MoneyMask>{formatMoney(newYield)}</MoneyMask>
              </span>
            </div>
          </div>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Sincronizando…" : "Sincronizar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
