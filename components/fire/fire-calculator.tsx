"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { computeFire, type FireInputs } from "@/lib/financial/fire";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * Calculator interativo: usuário ajusta sliders e vê impacto em tempo real
 * no patrimônio alvo + meses até FIRE. Não persiste — só pra brincadeira.
 */
export function FireCalculator({ base }: { base: FireInputs }) {
  const [monthlyAddition, setMonthlyAddition] = useState(base.monthlyAddition);
  const [targetIncome, setTargetIncome] = useState(base.targetMonthlyIncome);
  const [returnPct, setReturnPct] = useState(base.realAnnualReturnPct);
  const [swrPct, setSwrPct] = useState(base.swrPct);

  const result = useMemo(
    () =>
      computeFire({
        ...base,
        monthlyAddition,
        targetMonthlyIncome: targetIncome,
        realAnnualReturnPct: returnPct,
        swrPct,
      }),
    [base, monthlyAddition, targetIncome, returnPct, swrPct],
  );

  const baseResult = useMemo(() => computeFire(base), [base]);
  const deltaYears =
    result.yearsToFire != null && baseResult.yearsToFire != null
      ? result.yearsToFire - baseResult.yearsToFire
      : null;

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
      {/* Controles */}
      <div className="space-y-5">
        <SliderField
          label="Aporte mensal"
          value={monthlyAddition}
          onChange={setMonthlyAddition}
          min={0}
          max={Math.max(20000, base.monthlyAddition * 3)}
          step={50}
          format={(v) => formatMoney(v)}
        />
        <SliderField
          label="Renda passiva alvo"
          value={targetIncome}
          onChange={setTargetIncome}
          min={0}
          max={Math.max(50000, base.targetMonthlyIncome * 2)}
          step={100}
          format={(v) => `${formatMoney(v)}/mês`}
        />
        <SliderField
          label="Retorno real (% a.a.)"
          value={returnPct}
          onChange={setReturnPct}
          min={0}
          max={15}
          step={0.5}
          format={(v) => `${v.toFixed(1).replace(".", ",")}%`}
        />
        <SliderField
          label="Safe Withdrawal Rate (%)"
          value={swrPct}
          onChange={setSwrPct}
          min={2}
          max={6}
          step={0.25}
          format={(v) => `${v.toFixed(2).replace(".", ",")}%`}
        />
      </div>

      {/* Resultado */}
      <div className="rounded-[10px] border border-border bg-surface-muted/40 p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
          Resultado em tempo real
        </div>
        <div className="space-y-3">
          <Row
            label="Patrimônio alvo"
            value={formatMoney(result.fireTargetNetWorth)}
            tone="navy"
          />
          <Row
            label="Tempo até FIRE"
            value={
              result.yearsToFire == null
                ? "—"
                : result.yearsToFire < 1
                  ? `${Math.round(result.monthsToFire ?? 0)} meses`
                  : `${result.yearsToFire.toFixed(1).replace(".", ",")} anos`
            }
            tone="foreground"
            big
          />
          {result.ageAtFire != null ? (
            <Row
              label="Idade ao atingir"
              value={`${Math.round(result.ageAtFire)} anos`}
              tone="muted"
            />
          ) : null}
          {deltaYears != null && Math.abs(deltaYears) >= 0.05 ? (
            <div className="pt-2 mt-2 border-t border-border">
              <Badge tone={deltaYears < 0 ? "olive" : "rust"}>
                {deltaYears < 0
                  ? `${Math.abs(deltaYears).toFixed(1).replace(".", ",")} anos antes do baseline`
                  : `${deltaYears.toFixed(1).replace(".", ",")} anos depois do baseline`}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <Field label={label} htmlFor={`s-${label}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[14px] tabular-nums text-foreground">
          <MoneyMask>{format(value)}</MoneyMask>
        </span>
      </div>
      <input
        id={`s-${label}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-navy-700"
      />
      <div className="flex justify-between font-mono text-[10px] text-faint-foreground tracking-[0.04em] mt-1">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </Field>
  );
}

function Row({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone: "navy" | "foreground" | "muted";
  big?: boolean;
}) {
  const toneClass =
    tone === "navy"
      ? "text-navy-700 dark:text-navy-300"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span
        className={
          "font-mono tabular-nums " +
          (big ? "text-[20px] tracking-[-0.02em] font-medium " : "text-[13px] ") +
          toneClass
        }
      >
        <MoneyMask>{value}</MoneyMask>
      </span>
    </div>
  );
}
