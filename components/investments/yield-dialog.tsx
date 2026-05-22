"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { recordMonthlyYield } from "@/services/investments.actions";
import { formatMoney } from "@/lib/utils/format";
import type { Tables } from "@/types/database";

type Investment = Tables<"investments">;

function currentMonthFirstDay(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function YieldDialog({
  open,
  onOpenChange,
  investment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment: Investment;
}) {
  const [month, setMonth] = useState(() => currentMonthFirstDay().slice(0, 7));
  const [gross, setGross] = useState(0);
  const [tax, setTax] = useState(0);
  const [pending, startTransition] = useTransition();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMonth(currentMonthFirstDay().slice(0, 7));
      setGross(0);
      setTax(0);
    }
  }

  const handleSubmit = (formData: FormData) => {
    // O service espera 'YYYY-MM-DD' (primeiro dia do mês)
    formData.set("month", `${formData.get("month")}-01`);
    startTransition(async () => {
      const r = await recordMonthlyYield(formData);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Rendimento registrado.");
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow={`Rendimento · ${investment.ticker}`}
          title="Registrar rendimento do mês."
          description={`${investment.name}. Valor BRUTO recebido (proventos, juros, dividendos). Se já tem registro do mês, ele é substituído.`}
        />
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="investmentId" value={investment.id} />

          <Field label="Mês de referência" htmlFor="month">
            <Input
              id="month"
              name="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>

          <Field
            label="Rendimento bruto"
            htmlFor="grossYield"
            hint="Valor cheio antes do IR (proventos, juros, dividendos somados)"
          >
            <MoneyInput name="grossYield" id="grossYield" defaultValue={0} onValueChange={setGross} />
          </Field>

          <Field
            label="IR retido"
            htmlFor="tax"
            hint={
              investment.tax_regime === "exempt"
                ? "Esse ativo é isento (FII, LCI, etc.) — deixe zero."
                : "Imposto retido na fonte. Em corretora, geralmente já vem descontado."
            }
          >
            <MoneyInput
              name="tax"
              id="tax"
              defaultValue={0}
              onValueChange={setTax}
            />
          </Field>

          <p className="text-[12.5px] font-mono text-muted-foreground">
            Líquido: <b className="text-olive-700">{formatMoney(gross - tax)}</b>
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : "Salvar rendimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
