"use client";

import { useState, useTransition } from "react";
import { Calculator, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import type { SaleSimulation } from "@/services/ir/sale-simulator";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function SaleSimulatorDialog({
  open,
  onOpenChange,
  investmentId,
  ticker,
  currentQty,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investmentId: string;
  ticker: string;
  currentQty: number;
}) {
  const [qty, setQty] = useState(currentQty);
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isDayTrade, setIsDayTrade] = useState(false);
  const [simulation, setSimulation] = useState<SaleSimulation | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSimulate = () => {
    if (!qty || !price) {
      toast.error("Informe quantidade e preço.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/ir/simulate-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId,
          qty,
          unitPrice: price,
          saleDate: date,
          isDayTrade,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Falha na simulação");
        return;
      }
      setSimulation(data);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader title={
          <span className="inline-flex items-center gap-2">
            <Calculator className="w-5 h-5" strokeWidth={1.7} />
            Simular venda — {ticker}
          </span>
        } />


        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <Field label="Quantidade" htmlFor="sim-qty" hint={`max ${currentQty}`}>
              <Input
                id="sim-qty"
                type="number"
                step="any"
                min="0.00000001"
                max={currentQty}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </Field>
            <Field label="Preço unitário" htmlFor="sim-price">
              <MoneyInput
                name="sim-price"
                defaultValue={price}
                onValueChange={setPrice}
              />
            </Field>
            <Field label="Data" htmlFor="sim-date">
              <Input
                id="sim-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Day trade?" htmlFor="sim-day">
              <label className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="sim-day"
                  checked={isDayTrade}
                  onChange={(e) => setIsDayTrade(e.target.checked)}
                  className="accent-navy-700"
                />
                <span className="text-[12.5px] text-foreground">Same day</span>
              </label>
            </Field>
          </div>

          <Button variant="primary" onClick={handleSimulate} disabled={pending} className="w-full">
            {pending ? "Calculando…" : "Simular impacto fiscal"}
          </Button>

          {simulation ? (
            <div className="space-y-4 border-t border-border pt-4">
              {/* KPIs principais */}
              <div className="grid grid-cols-3 gap-3">
                <Box label="Lucro/Prejuízo" value={simulation.profit} negative={!simulation.isProfit} positive={simulation.isProfit} />
                <Box label="DARF a pagar" value={simulation.darfDue} negative={simulation.darfDue > 0} />
                <Box label="Líquido na conta" value={simulation.grossSale - simulation.darfDue} />
              </div>

              {/* Detalhes */}
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="space-y-1">
                  <Line label="Custo médio" value={simulation.averageCost} />
                  <Line label="Custo da venda" value={simulation.costBasis} />
                  <Line label="Valor bruto" value={simulation.grossSale} />
                </div>
                <div className="space-y-1">
                  <Line label="Vendas mês até hoje" value={simulation.monthSalesSoFar} />
                  <Line label="Vendas mês após esta" value={simulation.monthSalesAfterThis} />
                  <Line label="Carryforward usado" value={simulation.carryforwardWillUse} />
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-wrap gap-2">
                {simulation.exemptionApplied ? (
                  <Badge tone="olive">
                    <CheckCircle2 className="w-3 h-3 mr-1 inline" strokeWidth={2} />
                    Isenção R$ 20k aplicada
                  </Badge>
                ) : null}
                {simulation.isDayTrade ? <Badge tone="gold">Day trade · 20%</Badge> : null}
                {simulation.taxRate > 0 ? (
                  <Badge tone="navy">Alíquota {(simulation.taxRate * 100).toFixed(0)}%</Badge>
                ) : null}
                {simulation.irrfWithheld > 0 ? (
                  <Badge tone="neutral">IRRF retido R$ {fmtBRL(simulation.irrfWithheld)}</Badge>
                ) : null}
                {simulation.darfDue > 0 ? (
                  <Badge tone="rust">DARF venc {simulation.darfDueDate.split("-").reverse().join("/")}</Badge>
                ) : null}
              </div>

              {/* Warnings */}
              {simulation.warnings.length > 0 ? (
                <div className="rounded-[8px] border border-gold-600/30 bg-gold-600/5 p-3 space-y-1.5">
                  {simulation.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-foreground">
                      <AlertCircle className="w-3.5 h-3.5 text-gold-700 shrink-0 mt-0.5" strokeWidth={1.8} />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="text-[11px] text-faint-foreground pt-2">
            ⚠️ Simulação informativa. A venda real precisa ser executada na sua
            corretora — o app só calcula o impacto fiscal pra te ajudar a decidir.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Box({
  label, value, positive, negative,
}: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-[8px] border border-border p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div
        className={
          "font-mono text-[18px] tabular-nums mt-1 " +
          (positive ? "text-olive-700" : negative ? "text-rust-600" : "text-foreground")
        }
      >
        R$ {fmtBRL(value)}
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2 items-baseline">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">R$ {fmtBRL(value)}</span>
    </div>
  );
}
