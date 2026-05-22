"use client";

import { formatMoneyParts } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { RollingNumber } from "@/components/ui/rolling-number";
import { useLiveYield } from "@/hooks/use-live-yield";
import { useComparisonCurrency, useDisplayCurrency, useMoneyContext } from "@/components/ui/money-provider";
import { convert, CURRENCY_SYMBOLS, formatCurrency } from "@/lib/financial/currency";
import { maskMoneyString, usePrivacy } from "@/components/ui/privacy-provider";

const HERO_QUOTE =
  "o dinheiro que sobra silencioso no fim do mês é o que constrói liberdade no fim da década.";

export function DashboardHero({
  projectedNet,
  monthLabel,
  netConfidence,
  income,
  expense,
  patrimonio,
  monthRatio,
  expenseRatio,
  liveDailyYield = 0,
  livePerSecond = 0,
}: {
  projectedNet: number;
  monthLabel: string;
  netConfidence: "low" | "high";
  income: number;
  expense: number;
  patrimonio: number;
  monthRatio: number; // 0..1
  expenseRatio: number; // gasto vs receita 0..1+
  liveDailyYield?: number;
  livePerSecond?: number;
}) {
  const displayCurrency = useDisplayCurrency();
  const comparisonCurrency = useComparisonCurrency();
  const { rates } = useMoneyContext();
  const { hidden } = usePrivacy();
  const { accumulated: liveAccrued } = useLiveYield(liveDailyYield, livePerSecond);
  // Patrimônio total respira ao vivo somando o rendimento do dia até este instante
  const patrimonioLive = patrimonio + liveAccrued;
  const { currency, integer, cents, sign } = formatMoneyParts(projectedNet, displayCurrency);
  const positiveTrend = projectedNet >= 0;
  const currencySymbol = CURRENCY_SYMBOLS[displayCurrency];
  const maskedInteger = hidden ? maskMoneyString(integer) : integer;
  const maskedCents = hidden ? maskMoneyString(cents) : cents;

  // Linha de comparação abaixo da sobra projetada (se ligada)
  const projectedComparison =
    comparisonCurrency && comparisonCurrency !== displayCurrency
      ? convert(projectedNet, displayCurrency, comparisonCurrency, rates)
      : null;
  const projectedComparisonText =
    projectedComparison != null
      ? `≈ ${formatCurrency(projectedComparison, comparisonCurrency!)}`
      : null;

  // Mood strip: 10 segmentos por dias do mês transcorridos.
  // Cor olive enquanto expenseRatio < 0.9; gold se passar; rust se acima de 1.
  const filledSegments = Math.round(monthRatio * 10);
  const segmentTone =
    expenseRatio > 1 ? "rust" : expenseRatio > 0.9 ? "gold" : "olive";

  return (
    <section className="relative rounded-[var(--radius-xl)] bg-ink-950 text-white p-9 sm:p-12 mb-6 overflow-hidden shadow-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px]"
        style={{ background: "radial-gradient(circle, rgba(176,123,50,0.18), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 w-[360px] h-[360px]"
        style={{ background: "radial-gradient(circle, rgba(96,126,168,0.15), transparent 70%)" }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-8 mb-9">
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 mb-3 font-medium">
              Sobra projetada · {monthLabel}
            </div>
            <div className="flex items-baseline gap-3 mb-1 font-mono">
              <span className="text-[20px] text-navy-300 font-light">{currency}</span>
              <span className="text-[52px] sm:text-[60px] font-light leading-none tracking-[-0.04em]">
                {sign}
                {maskedInteger}
              </span>
              <span className="text-[24px] text-navy-300 font-light">,{maskedCents}</span>
            </div>
            {projectedComparisonText ? (
              <div className="font-mono text-[12.5px] text-navy-400 tracking-[0.02em] mb-3">
                {hidden ? maskMoneyString(projectedComparisonText) : projectedComparisonText}
              </div>
            ) : (
              <div className="mb-3" />
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-medium",
                  positiveTrend
                    ? "bg-olive-600/20 text-[#b5cb8c]"
                    : "bg-rust-600/20 text-[#e4a395]",
                )}
              >
                <span className="font-mono text-[10px]">{positiveTrend ? "↑" : "↓"}</span>
                {positiveTrend ? "Ritmo saudável" : "Atenção ao gasto"}
              </span>
              <span className="text-[11.5px] text-navy-400 font-mono">
                Confiança {netConfidence === "high" ? "alta" : "preliminar"}
              </span>
            </div>

            <div className="flex gap-[3px] mt-5 max-w-[280px]">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < filledSegments;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 h-[3px] rounded-full transition-colors",
                      filled
                        ? segmentTone === "olive"
                          ? "bg-olive-600"
                          : segmentTone === "gold"
                            ? "bg-gold-600"
                            : "bg-rust-600"
                        : "bg-ink-700",
                    )}
                  />
                );
              })}
            </div>
          </div>

          <div className="hidden sm:block max-w-[260px] text-right">
            <p className="font-display italic font-light text-[13px] leading-[1.6] text-navy-300 tracking-[-0.005em]">
              <span className="text-gold-600 mr-1">—</span>
              {HERO_QUOTE}
            </p>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-ink-700 to-transparent mb-7" />

        <div className="grid grid-cols-3 gap-6">
          <Stat
            label="Entrou"
            value={income}
            symbol={currencySymbol}
            hidden={hidden}
            displayCurrency={displayCurrency}
            comparisonCurrency={comparisonCurrency}
            rates={rates}
          />
          <Stat
            label="Saiu"
            value={expense}
            symbol={currencySymbol}
            hidden={hidden}
            displayCurrency={displayCurrency}
            comparisonCurrency={comparisonCurrency}
            rates={rates}
          />
          <Stat
            label="Patrimônio"
            value={patrimonioLive}
            accent
            live={liveDailyYield > 0}
            symbol={currencySymbol}
            hidden={hidden}
            displayCurrency={displayCurrency}
            comparisonCurrency={comparisonCurrency}
            rates={rates}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  live,
  symbol,
  hidden,
  displayCurrency,
  comparisonCurrency,
  rates,
}: {
  label: string;
  value: number;
  accent?: boolean;
  live?: boolean;
  symbol: string;
  hidden?: boolean;
  displayCurrency: "BRL" | "EUR" | "USD";
  comparisonCurrency: "BRL" | "EUR" | "USD" | null;
  rates: Record<string, number>;
}) {
  const fmt = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  });
  const fmt2 = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const compValue =
    comparisonCurrency && comparisonCurrency !== displayCurrency
      ? convert(value, displayCurrency, comparisonCurrency, rates)
      : null;
  const compText =
    compValue != null && comparisonCurrency
      ? `≈ ${formatCurrency(compValue, comparisonCurrency)}`
      : null;
  return (
    <div>
      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-navy-400 mb-2 font-medium flex items-center gap-1.5">
        {live ? (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
        ) : null}
        {label}
      </div>
      <div className="font-mono text-[22px] sm:text-[26px] tracking-[-0.02em] font-light text-white tabular-nums">
        {hidden ? (
          <>{symbol} •••</>
        ) : live ? (
          <>{symbol} {fmt2.format(value)}</>
        ) : (
          <>{symbol} <RollingNumber value={value} format={(n) => fmt.format(Math.round(n))} /></>
        )}
      </div>
      {compText ? (
        <div className="text-[11px] font-mono text-navy-400 mt-1 tabular-nums">
          {hidden ? maskMoneyString(compText) : compText}
        </div>
      ) : null}
      {accent ? (
        <div className="text-[11.5px] font-mono text-navy-300 mt-1">
          {live ? "contas + investimentos + bens · respirando ao vivo" : "contas + investimentos + bens"}
        </div>
      ) : null}
    </div>
  );
}
