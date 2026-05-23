"use client";

import { Flame, Trophy } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils/cn";

/**
 * Card de Independência Financeira — métrica-chave pra quem está
 * construindo patrimônio rumo à IF.
 *
 * Mostra:
 *  - Renda passiva mensal estimada (live yield × 21 dias úteis)
 *  - Despesa fixa média (últimos 3 meses)
 *  - % de cobertura
 *  - ETA: quantos meses pra atingir 100% de cobertura no ritmo atual
 *    (assumindo que a velocidade de yield cresce com a sobra reinvestida)
 */
export function FireCard({
  monthlyPassiveIncome,
  monthlyExpense,
  netWorth,
  monthlySavings,
}: {
  monthlyPassiveIncome: number;
  monthlyExpense: number;
  netWorth: number;
  /** Sobra média mensal (renda - despesa). Usada pra estimar ETA. */
  monthlySavings: number;
}) {
  const ratio = monthlyExpense > 0 ? monthlyPassiveIncome / monthlyExpense : 0;
  const pct = Math.min(200, Math.round(ratio * 100));
  const isAchieved = ratio >= 1;

  // Pra estimar ETA: assumimos taxa de retorno da carteira ≈ relação
  // passiveIncome / netWorth (aproximação). Falta cobrir = expense - passive.
  // Patrimônio necessário pra cobrir tudo = expense / yieldRate.
  const yieldRate = netWorth > 0 ? monthlyPassiveIncome / netWorth : 0;
  const requiredNetWorth = yieldRate > 0 ? monthlyExpense / yieldRate : null;
  const gapNetWorth = requiredNetWorth != null ? Math.max(0, requiredNetWorth - netWorth) : null;
  // Anos pra fechar o gap, ao ritmo de poupança mensal (sem juros compostos,
  // estimativa conservadora). Se sobra <= 0, sem ETA.
  const monthsToFI =
    gapNetWorth != null && monthlySavings > 0
      ? Math.ceil(gapNetWorth / monthlySavings)
      : null;

  return (
    <Panel className="!p-7 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48"
        style={{
          background: isAchieved
            ? "radial-gradient(circle, rgba(59,231,114,0.18), transparent 70%)"
            : "radial-gradient(circle, rgba(176,123,50,0.10), transparent 70%)",
        }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint-foreground font-medium mb-1.5 flex items-center gap-1.5">
              {isAchieved ? (
                <Trophy className="w-3 h-3 text-olive-700" strokeWidth={1.8} />
              ) : (
                <Flame className="w-3 h-3 text-gold-700" strokeWidth={1.8} />
              )}
              Independência financeira
            </div>
            <div className="font-display text-[26px] tracking-[-0.025em] text-foreground leading-tight">
              {isAchieved ? (
                <>Você já está <em className="italic text-olive-700">livre</em>.</>
              ) : (
                <>
                  <span className="text-navy-700 dark:text-navy-300">{pct}%</span> das despesas cobertas
                </>
              )}
            </div>
          </div>
          <CoverageRing pct={pct} achieved={isAchieved} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-5 pt-5 border-t border-border">
          <Stat
            label="Renda passiva /mês"
            value={monthlyPassiveIncome}
            tone="positive"
            hint="yield mensal estimado"
          />
          <Stat
            label="Despesa fixa /mês"
            value={monthlyExpense}
            tone="neutral"
            hint="média dos últimos 3 meses"
          />
          {!isAchieved && gapNetWorth != null && gapNetWorth > 0 ? (
            <Stat
              label="Falta no patrimônio"
              value={gapNetWorth}
              tone="neutral"
              hint={`pra cobertura total (${yieldRate > 0 ? (yieldRate * 12 * 100).toFixed(1) : "—"}% a.a.)`}
            />
          ) : null}
          {!isAchieved && monthsToFI != null ? (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                Tempo estimado
              </div>
              <div className="font-mono text-[16px] mt-1 text-foreground">
                {monthsToFI < 12 ? (
                  <>~{monthsToFI} {monthsToFI === 1 ? "mês" : "meses"}</>
                ) : (
                  <>~{(monthsToFI / 12).toFixed(1).replace(".", ",")} anos</>
                )}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                no ritmo de aporte atual
              </div>
            </div>
          ) : null}
          {!isAchieved && monthlySavings <= 0 ? (
            <div className="col-span-2">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                Tempo estimado
              </div>
              <div className="font-mono text-[13px] mt-1 text-rust-600">
                sem sobra mensal — sem trajetória
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function CoverageRing({ pct, achieved }: { pct: number; achieved: boolean }) {
  const display = Math.min(100, pct);
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-[78px] h-[78px] shrink-0">
      <svg width="78" height="78" viewBox="0 0 78 78" className="-rotate-90">
        <circle
          cx="39"
          cy="39"
          r={r}
          fill="none"
          stroke="var(--color-navy-100)"
          strokeWidth="4.5"
        />
        <circle
          cx="39"
          cy="39"
          r={r}
          fill="none"
          stroke={achieved ? "var(--color-olive-600)" : "var(--color-navy-800)"}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - display / 100)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono leading-none">
        <span className="text-[18px] font-medium text-foreground">{pct}%</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-olive-700 dark:text-olive-500"
      : tone === "negative"
        ? "text-rust-600"
        : "text-foreground";
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <Money
        value={value}
        showComparison
        className={cn(
          "text-[16px] tracking-[-0.01em] mt-1 items-start",
          toneClass,
        )}
        secondaryClassName="text-[10px]"
      />
      {hint ? (
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      ) : null}
    </div>
  );
}
