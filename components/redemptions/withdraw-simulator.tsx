"use client";

import { useState } from "react";
import { ArrowRight, TrendingDown } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import { Panel } from "@/components/ui/panel";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * "E se eu sacar R$ X?" — simulador interativo que mostra ao vivo:
 *  - Quanto vem do rendimento acumulado (não diminui patrimônio)
 *  - Quanto sai do principal (diminui patrimônio)
 *  - Impacto: novo principal, nova renda mensal estimada, nova cobertura
 *
 * Quando o usuário arrasta o valor, todos os números reagem. Educacional —
 * ensina visualmente onde está o limite entre "viver dos juros" e "consumir
 * o ovo da galinha".
 *
 * Usa o yieldRate atual (dailyYield × 252 / principal) pra projetar a nova
 * renda mensal assumindo manutenção do rendimento %.
 */
export function WithdrawSimulator({
  sacavelAgora,
  principal,
  monthlyYield,
  monthlyExpense,
}: {
  sacavelAgora: number;
  principal: number;
  monthlyYield: number;
  monthlyExpense: number;
}) {
  const maxSensible = principal + sacavelAgora;
  // Default: sugere sacar 50% do disponível
  const [amount, setAmount] = useState<number>(
    Math.round((sacavelAgora * 0.5) / 100) * 100,
  );

  const fromYield = Math.min(amount, sacavelAgora);
  const fromPrincipal = Math.max(0, amount - sacavelAgora);
  const newPrincipal = Math.max(0, principal - fromPrincipal);
  // Taxa de rendimento implícita (% mensal) — mantém ao reduzir principal
  const yieldRate = principal > 0 ? monthlyYield / principal : 0;
  const newMonthlyYield = newPrincipal * yieldRate;
  const newCoverage = monthlyExpense > 0 ? newMonthlyYield / monthlyExpense : 0;
  const oldCoverage = monthlyExpense > 0 ? monthlyYield / monthlyExpense : 0;
  const coverageDelta = newCoverage - oldCoverage;

  const tocaPrincipal = fromPrincipal > 0.01;

  return (
    <Panel className="!p-7">
      <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
        Simulador · e se eu sacar
      </div>
      <p className="text-[12.5px] text-muted-foreground mb-5 leading-relaxed">
        Arraste pra ver o impacto antes de virar regra. Verde = sai do rendimento
        (saudável). Vermelho = sai do principal (encolhe o ovo da galinha).
      </p>

      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <label htmlFor="sim-amount" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            Quanto sacar
          </label>
          <span className="font-mono text-[10.5px] text-faint-foreground">
            limite seguro: <b className="text-olive-700 dark:text-olive-500">{formatMoney(sacavelAgora)}</b>
          </span>
        </div>
        <MoneyInput
          id="sim-amount"
          name="sim-amount"
          defaultValue={amount}
          onValueChange={setAmount}
          size="lg"
        />
        {/* Slider — atalho visual rápido */}
        <input
          type="range"
          min={0}
          max={Math.max(sacavelAgora * 2, 1000)}
          step={100}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full mt-3 accent-navy-700"
          aria-label="Valor a sacar"
        />
        <div className="flex justify-between font-mono text-[10px] text-faint-foreground tracking-[0.05em] mt-1">
          <span>0</span>
          <span>limite seguro</span>
          <span>2× limite</span>
        </div>
      </div>

      {/* Composição do saque */}
      <div className="rounded-[10px] border border-border bg-surface-muted px-5 py-4 mb-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
          Composição
        </div>
        <CompositionBar
          fromYield={fromYield}
          fromPrincipal={fromPrincipal}
          total={amount}
          maxSensible={maxSensible}
        />
        <div className="grid grid-cols-2 gap-4 mt-3.5 text-[12.5px] font-mono">
          <div>
            <div className="text-faint-foreground text-[10.5px] uppercase tracking-[0.12em]">
              Do rendimento
            </div>
            <div className="text-olive-700 dark:text-olive-500 font-medium tabular-nums mt-0.5">
              <MoneyMask>{formatMoney(fromYield)}</MoneyMask>
            </div>
          </div>
          <div>
            <div className="text-faint-foreground text-[10.5px] uppercase tracking-[0.12em]">
              Do principal
            </div>
            <div
              className={`font-medium tabular-nums mt-0.5 ${
                tocaPrincipal ? "text-rust-600" : "text-muted-foreground"
              }`}
            >
              <MoneyMask>{formatMoney(fromPrincipal)}</MoneyMask>
            </div>
          </div>
        </div>
      </div>

      {/* Impacto */}
      <div className="rounded-[10px] border border-border bg-surface px-5 py-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3 inline-flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3" strokeWidth={1.8} />
          Impacto depois do saque
        </div>
        <ul className="space-y-2.5 text-[13px] font-mono">
          <ImpactRow
            label="Principal"
            before={principal}
            after={newPrincipal}
            tone={tocaPrincipal ? "negative" : "neutral"}
          />
          <ImpactRow
            label="Renda mensal estimada"
            before={monthlyYield}
            after={newMonthlyYield}
            tone={tocaPrincipal ? "negative" : "neutral"}
          />
          <ImpactRow
            label="Cobertura de despesas"
            before={oldCoverage}
            after={newCoverage}
            tone={Math.abs(coverageDelta) < 0.005 ? "neutral" : coverageDelta < 0 ? "negative" : "positive"}
            asPercent
          />
        </ul>

        {tocaPrincipal ? (
          <div className="mt-4 px-3 py-2 rounded-[8px] bg-rust-600/10 border border-rust-600/20 text-[12px] text-rust-600 leading-relaxed">
            ⚠ Esse saque <em className="italic">reduz</em> seu principal em{" "}
            <b><MoneyMask>{formatMoney(fromPrincipal)}</MoneyMask></b> — e a renda
            mensal cai pra sempre em{" "}
            <b><MoneyMask>{formatMoney(monthlyYield - newMonthlyYield)}</MoneyMask></b>.
            Considere sacar no máximo <b>{formatMoney(sacavelAgora)}</b> pra
            ficar só nos juros.
          </div>
        ) : amount > 0 ? (
          <div className="mt-4 px-3 py-2 rounded-[8px] bg-olive-600/10 border border-olive-600/20 text-[12px] text-olive-700 dark:text-olive-500 leading-relaxed">
            ✓ Saque dentro do rendimento — principal e renda mensal{" "}
            <em className="italic">não mudam</em>.
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function CompositionBar({
  fromYield,
  fromPrincipal,
  total,
  maxSensible,
}: {
  fromYield: number;
  fromPrincipal: number;
  total: number;
  maxSensible: number;
}) {
  const yieldPct = total > 0 ? (fromYield / total) * 100 : 0;
  const principalPct = total > 0 ? (fromPrincipal / total) * 100 : 0;
  // Tamanho da barra proporcional ao máximo "sensato" pra dar referência visual
  const totalScale = maxSensible > 0 ? Math.min(100, (total / maxSensible) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="h-2 rounded-full bg-bone-200 dark:bg-ink-800 overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 transition-all duration-300 flex"
          style={{ width: `${totalScale}%` }}
        >
          <div
            className="h-full bg-olive-600 transition-[width] duration-300"
            style={{ width: `${yieldPct}%` }}
          />
          <div
            className="h-full bg-rust-600 transition-[width] duration-300"
            style={{ width: `${principalPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ImpactRow({
  label,
  before,
  after,
  tone,
  asPercent,
}: {
  label: string;
  before: number;
  after: number;
  tone: "positive" | "negative" | "neutral";
  asPercent?: boolean;
}) {
  const fmt = (n: number) => (asPercent ? formatPercent(n, 0) : formatMoney(n));
  const toneClass =
    tone === "positive"
      ? "text-olive-700 dark:text-olive-500"
      : tone === "negative"
        ? "text-rust-600"
        : "text-foreground";
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-[12.5px]">{label}</span>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="text-faint-foreground text-[12px]">
          <MoneyMask>{fmt(before)}</MoneyMask>
        </span>
        <ArrowRight className="w-3 h-3 text-faint-foreground" strokeWidth={1.8} />
        <span className={`font-medium ${toneClass}`}>
          <MoneyMask>{fmt(after)}</MoneyMask>
        </span>
      </div>
    </li>
  );
}
