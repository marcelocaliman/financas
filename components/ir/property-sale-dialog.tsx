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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPropertySale,
  type PropertySaleFormState,
} from "@/services/ir/property-sale.actions";
import { computeGcap } from "@/lib/financial/gcap-calculator";
import { formatDateNumeric } from "@/lib/utils/format";
import type { Tables } from "@/types/database";

type PhysicalAsset = Pick<Tables<"physical_assets">, "id" | "name" | "category" | "acquired_at" | "acquired_value" | "current_value">;

export function PropertySaleDialog({
  open,
  onOpenChange,
  asset,
  filers = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset: PhysicalAsset;
  filers?: Tables<"ir_filers">[];
}) {
  const [salePrice, setSalePrice] = useState<number>(Number(asset.current_value) || 0);
  const [acquisitionCost, setAcquisitionCost] = useState<number>(Number(asset.acquired_value) || 0);
  const [saleDate, setSaleDate] = useState<string>(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  const [improvements, setImprovements] = useState<number>(0);
  const [acquisitionBrokerage, setAcquisitionBrokerage] = useState<number>(0);
  const [sellingExpenses, setSellingExpenses] = useState<number>(0);
  const [isUniqueResidencial, setIsUniqueResidencial] = useState(false);
  const [willReinvest, setWillReinvest] = useState(false);
  const [filerId, setFilerId] = useState<string>(filers[0]?.id ?? "");

  const [state, action, pending] = useActionState<PropertySaleFormState | undefined, FormData>(
    createPropertySale,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Venda registrada. DARF gerado.");
      onOpenChange(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  // Preview do GCAP em tempo real
  const acquiredAt = asset.acquired_at ?? "1996-01-01";
  const isRealEstate = asset.category === "real_estate";
  const gcapPreview = computeGcap({
    salePrice,
    acquisitionCost,
    improvements,
    acquisitionExtras: acquisitionBrokerage,
    sellingExpenses,
    acquiredAt,
    saleDate,
    assetKind: isRealEstate ? "real_estate" : "movable",
    isUniqueResidencialUnder440k: isUniqueResidencial,
    willReinvestIn180Days: willReinvest,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow="Venda de imóvel"
          title="Registrar venda."
          description="Calcula automaticamente ganho de capital, isenções e DARF a pagar até o último dia útil do mês seguinte."
        />

        <form action={action} className="space-y-4">
          <input type="hidden" name="physicalAssetId" value={asset.id} />
          <input type="hidden" name="acquiredAt" value={acquiredAt} />

          <Field label="Data da venda" htmlFor="saleDate" required>
            <Input
              id="saleDate"
              name="saleDate"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de venda" htmlFor="salePrice" required>
              <MoneyInput
                id="salePrice"
                name="salePrice"
                defaultValue={salePrice}
                onValueChange={setSalePrice}
              />
            </Field>
            <Field label="Custo de aquisição" htmlFor="acquisitionCost" hint="O que está declarado hoje">
              <MoneyInput
                id="acquisitionCost"
                name="acquisitionCost"
                defaultValue={acquisitionCost}
                onValueChange={setAcquisitionCost}
              />
            </Field>
          </div>

          {isRealEstate ? (
            <details className="text-[12.5px] text-muted-foreground">
              <summary className="cursor-pointer font-medium hover:text-foreground">
                Benfeitorias e despesas <span className="text-faint-foreground">· reduzem o ganho tributável</span>
              </summary>
              <div className="grid grid-cols-3 gap-3 pt-3">
                <Field label="Benfeitorias" htmlFor="improvements" hint="reformas comprovadas">
                  <MoneyInput id="improvements" name="improvements" defaultValue={improvements} onValueChange={setImprovements} />
                </Field>
                <Field label="Corretagem/ITBI (compra)" htmlFor="acquisitionBrokerage">
                  <MoneyInput id="acquisitionBrokerage" name="acquisitionBrokerage" defaultValue={acquisitionBrokerage} onValueChange={setAcquisitionBrokerage} />
                </Field>
                <Field label="Despesas de venda" htmlFor="sellingExpenses" hint="corretagem da venda">
                  <MoneyInput id="sellingExpenses" name="sellingExpenses" defaultValue={sellingExpenses} onValueChange={setSellingExpenses} />
                </Field>
              </div>
            </details>
          ) : null}

          {isRealEstate ? (
            <div className="space-y-2 rounded-[8px] bg-surface-muted/50 px-3 py-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px]">
                <input
                  type="checkbox"
                  name="isUniqueResidencialUnder440k"
                  value="1"
                  checked={isUniqueResidencial}
                  onChange={(e) => setIsUniqueResidencial(e.target.checked)}
                  className="mt-0.5 accent-navy-700"
                />
                <span>
                  <b className="text-foreground">Imóvel residencial único</b> (vale a isenção se preço ≤ R$ 440k)
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px]">
                <input
                  type="checkbox"
                  name="willReinvestIn180Days"
                  value="1"
                  checked={willReinvest}
                  onChange={(e) => setWillReinvest(e.target.checked)}
                  className="mt-0.5 accent-navy-700"
                />
                <span>
                  <b className="text-foreground">Vou comprar outro residencial em 180 dias</b> (isenção Lei 11.196)
                </span>
              </label>
            </div>
          ) : (
            <div className="rounded-[8px] bg-bone-50 dark:bg-ink-900 border border-border px-3 py-2.5 text-[12px] text-muted-foreground leading-relaxed">
              <b className="text-foreground">Bem móvel</b> — vendas até R$ 35.000/mês são isentas de GCAP
              (Lei 9.250/95 art. 22). Se você vendeu outros bens móveis no mesmo mês, a soma é checada
              automaticamente.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do comprador" htmlFor="buyerName">
              <Input id="buyerName" name="buyerName" />
            </Field>
            <Field label="CPF/CNPJ comprador" htmlFor="buyerCpfCnpj">
              <Input id="buyerCpfCnpj" name="buyerCpfCnpj" className="font-mono" />
            </Field>
          </div>

          {filers.length >= 2 ? (
            <Field label="Titular da declaração" htmlFor="filerId">
              <Select value={filerId} onValueChange={setFilerId} name="filerId">
                <SelectTrigger id="filerId"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filers.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : filers[0] ? (
            <input type="hidden" name="filerId" value={filers[0].id} />
          ) : null}

          <Field label="Observações" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>

          {/* Preview do GCAP */}
          <div className="rounded-[8px] border border-border bg-bone-50 dark:bg-ink-900 p-3 text-[12.5px] space-y-1.5 font-mono">
            <div className="font-sans text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground mb-2">
              Preview do ganho de capital
            </div>
            <Row label="Ganho bruto" value={gcapPreview.grossProfit} />
            {gcapPreview.reductionApplied > 0 ? (
              <Row label="Redução (tempo de posse)" value={-gcapPreview.reductionApplied} />
            ) : null}
            <Row label="Lucro tributável" value={gcapPreview.taxableProfit} highlight />
            {gcapPreview.exemption.applied ? (
              <p className="text-[11.5px] text-olive-700 dark:text-olive-200 font-sans mt-2 leading-relaxed">
                ✓ {gcapPreview.exemption.reason}
              </p>
            ) : null}
            <div className="border-t border-border pt-1.5 mt-2 flex justify-between">
              <span className="text-foreground">Imposto devido</span>
              <span className="text-foreground font-bold tabular-nums">
                R$ {gcapPreview.taxDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground font-sans">
              DARF <span className="font-mono">cód. 4600</span> (ganho de capital) vence em{" "}
              {formatDateNumeric(gcapPreview.darfDueDate)}
            </div>
          </div>

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : "Registrar venda"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="font-sans text-muted-foreground">{label}</span>
      <span className={highlight ? "text-foreground font-semibold tabular-nums" : "text-muted-foreground tabular-nums"}>
        R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}
