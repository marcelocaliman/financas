"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Calendar, Infinity, TrendingDown } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import { Panel } from "@/components/ui/panel";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { cn } from "@/lib/utils/cn";

type Mode = "pontual" | "recorrente";

/**
 * Simulador de saques de renda fixa em DOIS modos:
 *
 *  - "Pontual": "Se eu sacar R$ X agora, qual o impacto?" Mostra a perda na
 *    renda mensal pra sempre + se invade o principal. Matemática corrigida:
 *    cada R$ sacado reduz a base de composição, então a renda futura SEMPRE
 *    cai (não importa se o saque vem do yield acumulado ou do principal —
 *    a separação é só rótulo contábil; o dinheiro composto é o mesmo).
 *
 *  - "Recorrente": "Se eu sacar R$ X TODO MÊS, isso é sustentável?" Calcula
 *    quantos meses o saldo dura usando a fórmula da anuidade. Limite
 *    sustentável = monthlyYield (porque aí o saque iguala o rendimento e o
 *    saldo é perpétuo). Acima disso, depleção projetada.
 */
export function WithdrawSimulator({
  sacavelAgora,
  principal,
  derivedBalance,
  monthlyYield,
  monthlyExpense,
}: {
  /** Rendimento acumulado lifetime (= derivedBalance − principal) */
  sacavelAgora: number;
  /** Soma dos initial_amount aplicados */
  principal: number;
  /** Saldo derivado total (principal + accumulated). Base real de composição. */
  derivedBalance: number;
  /** Renda mensal estimada hoje (dailyYield × 21) */
  monthlyYield: number;
  /** Despesa mensal média (pra calcular cobertura) */
  monthlyExpense: number;
}) {
  const [mode, setMode] = useState<Mode>("pontual");

  // Taxa de composição mensal intrínseca (= Selic/CDI mensal, aproximado).
  // Aplicável a qualquer saldo: novo balance × monthlyRate = nova renda.
  const monthlyRate = derivedBalance > 0 ? monthlyYield / derivedBalance : 0;

  return (
    <Panel className="!p-7">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
          Simulador de saques
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <p className="text-[12.5px] text-muted-foreground mb-5 leading-relaxed">
        {mode === "pontual"
          ? "Veja o impacto de um saque único — quanto sai do rendimento, quanto invade o principal e a perda de renda mensal pra sempre."
          : "Veja se um saque mensal recorrente é sustentável ou consumirá seu patrimônio até esgotar."}
      </p>

      {mode === "pontual" ? (
        <PontualMode
          sacavelAgora={sacavelAgora}
          principal={principal}
          derivedBalance={derivedBalance}
          monthlyRate={monthlyRate}
          monthlyYield={monthlyYield}
          monthlyExpense={monthlyExpense}
        />
      ) : (
        <RecorrenteMode
          derivedBalance={derivedBalance}
          monthlyYield={monthlyYield}
          monthlyRate={monthlyRate}
          monthlyExpense={monthlyExpense}
        />
      )}
    </Panel>
  );
}

// ============================================================================
// PONTUAL — saque único agora
// ============================================================================

function PontualMode({
  sacavelAgora,
  principal,
  derivedBalance,
  monthlyRate,
  monthlyYield,
  monthlyExpense,
}: {
  sacavelAgora: number;
  principal: number;
  derivedBalance: number;
  monthlyRate: number;
  monthlyYield: number;
  monthlyExpense: number;
}) {
  // Default: sugere sacar 50% do que dá pra sacar sem invadir principal
  const [amount, setAmount] = useState<number>(
    Math.round((sacavelAgora * 0.5) / 100) * 100,
  );

  const fromYield = Math.min(amount, sacavelAgora);
  const fromPrincipal = Math.max(0, amount - sacavelAgora);
  const tocaPrincipal = fromPrincipal > 0.01;

  // Math corrigida: qualquer saque reduz a base de composição.
  const newDerivedBalance = Math.max(0, derivedBalance - amount);
  const newMonthlyYield = newDerivedBalance * monthlyRate;
  const newPrincipal = Math.max(0, principal - fromPrincipal);
  const lostMonthlyYield = monthlyYield - newMonthlyYield;
  const lostYearlyYield = lostMonthlyYield * 12;

  const oldCoverage = monthlyExpense > 0 ? monthlyYield / monthlyExpense : 0;
  const newCoverage = monthlyExpense > 0 ? newMonthlyYield / monthlyExpense : 0;

  const maxScale = Math.max(derivedBalance, sacavelAgora * 2, 1000);

  return (
    <div className="grid xl:grid-cols-[1fr_1.1fr] gap-6">
      {/* Coluna A: input + composição */}
      <div>
        {/* Input */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <label
              htmlFor="sim-amount"
              className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium"
            >
              Quanto sacar agora
            </label>
            <span className="font-mono text-[10.5px] text-faint-foreground">
              sem invadir principal:{" "}
              <b className="text-olive-700 dark:text-olive-500">
                {formatMoney(sacavelAgora)}
              </b>
            </span>
          </div>
          <MoneyInput
            id="sim-amount"
            name="sim-amount"
            defaultValue={amount}
            onValueChange={setAmount}
            size="lg"
          />
          <input
            type="range"
            min={0}
            max={maxScale}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full mt-3 accent-navy-700"
            aria-label="Valor a sacar"
          />
          <div className="flex justify-between font-mono text-[10px] text-faint-foreground tracking-[0.05em] mt-1">
            <span>0</span>
            <span>limite sem invadir</span>
            <span>saldo total</span>
          </div>
        </div>

        {/* Composição do saque (mantém a distinção visual yield vs principal) */}
        <div className="rounded-[10px] border border-border bg-surface-muted px-5 py-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
          De onde sai o dinheiro
        </div>
        <CompositionBar
          fromYield={fromYield}
          fromPrincipal={fromPrincipal}
          total={amount}
          maxScale={derivedBalance}
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
              className={cn(
                "font-medium tabular-nums mt-0.5",
                tocaPrincipal ? "text-rust-600" : "text-muted-foreground",
              )}
            >
              <MoneyMask>{formatMoney(fromPrincipal)}</MoneyMask>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Coluna B: Impacto real — corrigido: SEMPRE mostra a perda da renda */}
      <div className="rounded-[10px] border border-border bg-surface px-5 py-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3 inline-flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3" strokeWidth={1.8} />
          Impacto depois do saque
        </div>
        <ul className="space-y-2.5 text-[13px] font-mono">
          <ImpactRow
            label="Saldo total investido"
            before={derivedBalance}
            after={newDerivedBalance}
            tone={amount > 0.01 ? "negative" : "neutral"}
          />
          <ImpactRow
            label="Rendimento acumulado"
            before={sacavelAgora}
            after={Math.max(0, sacavelAgora - fromYield)}
            tone={fromYield > 0.01 ? "negative" : "neutral"}
          />
          <ImpactRow
            label="Capital aplicado"
            before={principal}
            after={newPrincipal}
            tone={tocaPrincipal ? "negative" : "neutral"}
          />
          <ImpactRow
            label="Renda mensal estimada"
            before={monthlyYield}
            after={newMonthlyYield}
            tone={amount > 0.01 ? "negative" : "neutral"}
          />
          <ImpactRow
            label="Cobertura de despesas"
            before={oldCoverage}
            after={newCoverage}
            tone={Math.abs(newCoverage - oldCoverage) < 0.005 ? "neutral" : "negative"}
            asPercent
          />
        </ul>

        {amount > 0.01 ? (
          <div
            className={cn(
              "mt-4 px-3 py-2 rounded-[8px] text-[12px] leading-relaxed",
              tocaPrincipal
                ? "bg-rust-600/10 border border-rust-600/20 text-rust-600"
                : "bg-bone-200/40 dark:bg-ink-700/30 border border-border text-foreground",
            )}
          >
            {tocaPrincipal ? (
              <>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Invade o principal em{" "}
                  <b>
                    <MoneyMask>{formatMoney(fromPrincipal)}</MoneyMask>
                  </b>
                  .
                </span>{" "}
                Sua renda mensal cai pra sempre em{" "}
                <b>
                  <MoneyMask>{formatMoney(lostMonthlyYield)}</MoneyMask>
                </b>{" "}
                (
                <MoneyMask>{formatMoney(lostYearlyYield)}</MoneyMask>/ano).
              </>
            ) : (
              <>
                Saque dentro do rendimento — o principal não é tocado. Mas a base
                de composição diminui, então a renda mensal cai em{" "}
                <b className="text-rust-600">
                  <MoneyMask>{formatMoney(lostMonthlyYield)}</MoneyMask>
                </b>{" "}
                pra sempre (
                <MoneyMask>{formatMoney(lostYearlyYield)}</MoneyMask>/ano).
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// RECORRENTE — saque mensal sustentável (anuidade)
// ============================================================================

function RecorrenteMode({
  derivedBalance,
  monthlyYield,
  monthlyRate,
  monthlyExpense,
}: {
  derivedBalance: number;
  monthlyYield: number;
  monthlyRate: number;
  monthlyExpense: number;
}) {
  // Default: sugere sacar exatamente o monthlyYield (perpétuo)
  const [monthlyDraw, setMonthlyDraw] = useState<number>(
    Math.round(monthlyYield),
  );

  const isPerpetual = monthlyDraw <= monthlyYield + 0.01;
  // Anuidade: B_n+1 = B_n × (1+r) − X. Esgota quando X > B × r.
  // n = ln(X / (X − B×r)) / ln(1+r)
  const monthsToDeplete = (() => {
    if (isPerpetual || monthlyRate <= 0) return null;
    const denom = monthlyDraw - derivedBalance * monthlyRate;
    if (denom <= 0) return null;
    return Math.log(monthlyDraw / denom) / Math.log(1 + monthlyRate);
  })();

  // Crescimento mensal (positivo) ou consumo (negativo) do saldo
  const monthlyBalanceDelta = derivedBalance * monthlyRate - monthlyDraw;

  const drawCoverage = monthlyExpense > 0 ? monthlyDraw / monthlyExpense : 0;

  return (
    <div className="grid xl:grid-cols-[1fr_1.1fr] gap-6">
      {/* Coluna A: highlight + input */}
      <div>
        <div className="rounded-[10px] bg-olive-50 dark:bg-olive-700/10 border border-olive-600/30 px-4 py-3 mb-4 text-[12.5px]">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-olive-700 dark:text-olive-500 font-medium mb-1">
            Sustentável pra sempre
          </div>
          <div className="font-mono text-[18px] tabular-nums text-foreground">
            <MoneyMask>{formatMoney(monthlyYield)}</MoneyMask>
            <span className="text-faint-foreground text-[12px] ml-1.5">/ mês</span>
          </div>
          <div className="text-muted-foreground text-[11.5px] mt-0.5 leading-relaxed">
            Até esse valor, o saque iguala o que o saldo rende — o principal não
            encolhe nunca.
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label
              htmlFor="sim-monthly"
              className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium"
            >
              Quanto sacar por mês
            </label>
            <span className="font-mono text-[10.5px] text-faint-foreground">
              limite perpétuo:{" "}
              <b className="text-olive-700 dark:text-olive-500">
                {formatMoney(monthlyYield)}
              </b>
            </span>
          </div>
          <MoneyInput
            id="sim-monthly"
            name="sim-monthly"
            defaultValue={monthlyDraw}
            onValueChange={setMonthlyDraw}
            size="lg"
          />
          <input
            type="range"
            min={0}
            max={Math.max(monthlyYield * 3, 100)}
            step={50}
            value={monthlyDraw}
            onChange={(e) => setMonthlyDraw(Number(e.target.value))}
            className="w-full mt-3 accent-navy-700"
            aria-label="Saque mensal hipotético"
          />
          <div className="flex justify-between font-mono text-[10px] text-faint-foreground tracking-[0.05em] mt-1">
            <span>0</span>
            <span>perpétuo</span>
            <span>3× perpétuo</span>
          </div>
        </div>
      </div>

      {/* Coluna B: projeção */}
      <div className="rounded-[10px] border border-border bg-surface px-5 py-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3 inline-flex items-center gap-1.5">
          <Calendar className="w-3 h-3" strokeWidth={1.8} />
          Projeção
        </div>

        {monthlyDraw <= 0.01 ? (
          <p className="text-[13px] text-faint-foreground italic">
            Digite um valor pra simular.
          </p>
        ) : isPerpetual ? (
          <div className="space-y-2.5">
            <StatusBadge tone="positive" icon={<Infinity className="w-3.5 h-3.5" strokeWidth={1.8} />}>
              Sustentável pra sempre
            </StatusBadge>
            <ul className="space-y-2 text-[13px] font-mono">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Sobra de rendimento</span>
                <span className="text-olive-700 dark:text-olive-500 tabular-nums">
                  + <MoneyMask>{formatMoney(monthlyBalanceDelta)}</MoneyMask>/mês
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Cobre da despesa</span>
                <span className="text-foreground tabular-nums">
                  {formatPercent(drawCoverage, 0)}
                </span>
              </li>
            </ul>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-3">
              Vc saca <b>{formatMoney(monthlyDraw)}</b>, e o saldo ainda cresce{" "}
              <b className="text-olive-700 dark:text-olive-500">
                {formatMoney(monthlyBalanceDelta)}/mês
              </b>{" "}
              porque rende mais do que vc tira.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <StatusBadge tone="negative" icon={<AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} />}>
              Insustentável — vai esgotar
            </StatusBadge>
            <ul className="space-y-2 text-[13px] font-mono">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Consumo mensal do saldo</span>
                <span className="text-rust-600 tabular-nums">
                  − <MoneyMask>{formatMoney(Math.abs(monthlyBalanceDelta))}</MoneyMask>/mês
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Dura aproximadamente</span>
                <span className="text-rust-600 tabular-nums">
                  {monthsToDeplete != null
                    ? formatDuration(monthsToDeplete)
                    : "—"}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Cobre da despesa</span>
                <span className="text-foreground tabular-nums">
                  {formatPercent(drawCoverage, 0)}
                </span>
              </li>
            </ul>
            <p className="text-[11.5px] text-rust-600 leading-relaxed mt-3">
              ⚠ Saque excede em{" "}
              <b>
                <MoneyMask>{formatMoney(monthlyDraw - monthlyYield)}</MoneyMask>
              </b>{" "}
              a renda mensal. Pra ser sustentável, reduza pra ≤{" "}
              <b>{formatMoney(monthlyYield)}/mês</b>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 bg-surface-muted rounded-[8px] shrink-0">
      {(["pontual", "recorrente"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium tracking-[-0.005em] transition-colors",
            mode === m
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === "pontual" ? "Pontual" : "Mensal"}
        </button>
      ))}
    </div>
  );
}

function CompositionBar({
  fromYield,
  fromPrincipal,
  total,
  maxScale,
}: {
  fromYield: number;
  fromPrincipal: number;
  total: number;
  maxScale: number;
}) {
  const yieldPct = total > 0 ? (fromYield / total) * 100 : 0;
  const principalPct = total > 0 ? (fromPrincipal / total) * 100 : 0;
  const totalScale = maxScale > 0 ? Math.min(100, (total / maxScale) * 100) : 0;

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
        <span className={cn("font-medium", toneClass)}>
          <MoneyMask>{fmt(after)}</MoneyMask>
        </span>
      </div>
    </li>
  );
}

function StatusBadge({
  tone,
  icon,
  children,
}: {
  tone: "positive" | "negative";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium",
        tone === "positive"
          ? "bg-olive-600/15 text-olive-700 dark:text-olive-500"
          : "bg-rust-600/15 text-rust-600",
      )}
    >
      {icon}
      {children}
    </div>
  );
}

function formatDuration(months: number): string {
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `${Math.round(months)} ${Math.round(months) === 1 ? "mês" : "meses"}`;
  const years = months / 12;
  if (years < 10) {
    const y = Math.floor(years);
    const m = Math.round(months - y * 12);
    if (m === 0) return `${y} ${y === 1 ? "ano" : "anos"}`;
    return `${y}a ${m}m`;
  }
  return `~${Math.round(years)} anos`;
}
