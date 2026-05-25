"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import {
  createPropertyRevaluation,
  type RevaluationFormState,
} from "@/services/ir/property-revaluation.actions";
import type { Tables } from "@/types/database";

type PhysicalAsset = Pick<Tables<"physical_assets">, "id" | "name" | "current_value">;

export function PropertyRevaluationDialog({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset: PhysicalAsset;
}) {
  const [previousValue, setPreviousValue] = useState<number>(Number(asset.current_value) || 0);
  const [newValue, setNewValue] = useState<number>(0);
  const [revaluationDate, setRevaluationDate] = useState<string>(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
  );

  const [state, action, pending] = useActionState<RevaluationFormState | undefined, FormData>(
    createPropertyRevaluation,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Atualização registrada. Pague o DARF até o vencimento.");
      onOpenChange(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  const difference = Math.max(0, newValue - previousValue);
  const taxPreview = Math.round(difference * 0.04 * 100) / 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow="Atualizar valor de imóvel"
          title="Lei 14.973/2024"
          description="Atualize o valor a mercado pagando 4% sobre a diferença. Reduz o GCAP em vendas futuras."
        />

        <form action={action} className="space-y-4">
          <input type="hidden" name="physicalAssetId" value={asset.id} />
          <input type="hidden" name="taxRate" value="0.04" />

          <Field label="Data da atualização" htmlFor="revaluationDate" required>
            <Input
              id="revaluationDate"
              name="revaluationDate"
              type="date"
              value={revaluationDate}
              onChange={(e) => setRevaluationDate(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor declarado hoje" htmlFor="previousValue" required>
              <MoneyInput
                id="previousValue"
                name="previousValue"
                defaultValue={previousValue}
                onValueChange={setPreviousValue}
              />
            </Field>
            <Field label="Novo valor a mercado" htmlFor="newValue" required>
              <MoneyInput
                id="newValue"
                name="newValue"
                defaultValue={newValue}
                onValueChange={setNewValue}
              />
            </Field>
          </div>

          <Field label="Ref. pagamento DARF (opcional)" htmlFor="darfPaymentReference">
            <Input id="darfPaymentReference" name="darfPaymentReference" placeholder="Nº DARF, conta de origem, etc." />
          </Field>

          <Field label="Observações" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>

          <div className="rounded-[8px] border border-border bg-bone-50 dark:bg-ink-900 p-3 text-[12.5px] space-y-1 font-mono">
            <div className="font-sans text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground mb-2">
              Imposto a pagar agora
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">Diferença</span>
              <span className="tabular-nums">R$ {difference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">Alíquota PF</span>
              <span>4%</span>
            </div>
            <div className="border-t border-border pt-1.5 mt-2 flex justify-between">
              <span className="text-foreground font-sans">DARF a pagar</span>
              <span className="text-foreground font-bold tabular-nums">
                R$ {taxPreview.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[11px] font-sans text-muted-foreground mt-2 leading-relaxed">
              Vantagem: em uma venda futura, o ganho de capital será sobre o novo valor (menor) — economiza muito mais imposto se for vender em ≥ 3 anos.
            </p>
          </div>

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : "Atualizar valor"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
