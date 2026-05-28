"use client";

import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  useComparisonCurrency,
  useDisplayCurrency,
  useMoneyContext,
} from "@/components/ui/money-provider";
import { convert, CURRENCY_SYMBOLS, formatCurrency } from "@/lib/financial/currency";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Currency } from "@/types/database";

/**
 * Card resumo da carteira — valor atual + custo de aquisição.
 *
 * Sem ticker animado nem "rendimento por segundo": ações/FIIs marcam a
 * mercado pela cotação brapi (atualizada ao recarregar), RF usa o
 * current_balance manual.
 */
export function PortfolioLiveTicker({
  totalMarketBalance,
  totalBaseBalance,
  displayCurrency: serverDisplayCurrency,
  variant = "compact",
}: {
  totalMarketBalance: number;
  totalBaseBalance: number;
  displayCurrency: Currency;
  variant?: "compact" | "full";
}) {
  const clientDisplayCurrency = useDisplayCurrency();
  const comparisonCurrency = useComparisonCurrency();
  const { rates } = useMoneyContext();
  const displayCurrency = clientDisplayCurrency ?? serverDisplayCurrency;
  const symbol = CURRENCY_SYMBOLS[displayCurrency];

  if (totalMarketBalance === 0 && totalBaseBalance === 0) return null;

  const gain = totalMarketBalance - totalBaseBalance;
  const gainPct = totalBaseBalance > 0 ? gain / totalBaseBalance : 0;

  const compEnabled = comparisonCurrency != null && comparisonCurrency !== displayCurrency;
  const patrimonioComp = compEnabled
    ? convert(totalMarketBalance, displayCurrency, comparisonCurrency, rates)
    : null;

  if (variant === "compact") {
    return (
      <section className="rounded-[var(--radius-lg)] bg-ink-950 text-white p-6 sm:p-7 mb-6 relative overflow-hidden border border-ink-700">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 font-medium mb-2">
              Carteira de investimentos
            </div>
            <div className="flex items-baseline gap-3 font-mono">
              <span className="text-[14px] text-navy-300 font-light">{symbol}</span>
              <span className="text-[34px] sm:text-[40px] font-light leading-none tracking-[-0.03em] tabular-nums">
                <MoneyMask>
                  {totalMarketBalance.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </MoneyMask>
              </span>
            </div>
            {patrimonioComp != null && comparisonCurrency ? (
              <div className="font-mono text-[11.5px] text-navy-400 mt-1 tabular-nums">
                ≈ <MoneyMask>{formatCurrency(patrimonioComp, comparisonCurrency)}</MoneyMask>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-3 text-[11.5px] font-mono text-navy-200">
              <Pill>
                Custo <b className="text-white"><MoneyMask>{formatMoney(totalBaseBalance, displayCurrency)}</MoneyMask></b>
              </Pill>
              <Pill>
                Ganho{" "}
                <b className={gain >= 0 ? "text-olive-500" : "text-rust-500"}>
                  <MoneyMask>{formatMoney(gain, displayCurrency)}</MoneyMask> ({(gainPct * 100).toFixed(1).replace(".", ",")}%)
                </b>
              </Pill>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ============== variant === "full" ==============
  return (
    <section className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-9 sm:p-10 mb-7 relative overflow-hidden shadow-lg border border-ink-700">
      <div className="relative z-10 grid sm:grid-cols-[1.5fr_auto] gap-8">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 font-medium mb-3.5">
            Carteira de investimentos
          </div>
          <div className="flex items-baseline gap-3 font-mono">
            <span className="text-[18px] text-navy-300 font-light">{symbol}</span>
            <span className="text-[44px] sm:text-[52px] font-light leading-none tracking-[-0.03em] tabular-nums">
              <MoneyMask>{totalMarketBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</MoneyMask>
            </span>
          </div>
          {patrimonioComp != null && comparisonCurrency ? (
            <div className="font-mono text-[12.5px] text-navy-400 mt-1 tabular-nums">
              ≈ <MoneyMask>{formatCurrency(patrimonioComp, comparisonCurrency)}</MoneyMask>
            </div>
          ) : null}
          <div className="flex gap-2 mt-5 flex-wrap">
            <Pill>
              Custo{" "}
              <b className="text-white"><MoneyMask>{formatMoney(totalBaseBalance, displayCurrency)}</MoneyMask></b>
            </Pill>
            <Pill>
              Ganho{" "}
              <b className={gain >= 0 ? "text-olive-500" : "text-rust-500"}>
                <MoneyMask>{formatMoney(gain, displayCurrency)}</MoneyMask> ({(gainPct * 100).toFixed(1).replace(".", ",")}%)
              </b>
            </Pill>
          </div>
        </div>

        <div className="sm:pl-9 sm:border-l border-ink-700 grid gap-4 content-start min-w-[220px]">
          <SideCell
            label="Investido"
            value={formatMoney(totalBaseBalance, displayCurrency)}
            mask
          />
          <SideCell
            label="Valor de mercado"
            value={formatMoney(totalMarketBalance, displayCurrency)}
            mask
          />
        </div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white/[0.05] px-3 py-1.5 rounded-[8px] font-mono text-[11.5px] tracking-[0.02em]">
      {children}
    </span>
  );
}

function SideCell({
  label,
  value,
  hint,
  tone,
  mask = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive";
  mask?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-navy-400 mb-1 font-medium">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-[15px] font-medium",
          tone === "positive" ? "text-olive-500" : "text-white",
        )}
      >
        {mask ? <MoneyMask>{value}</MoneyMask> : value}
      </div>
      {hint ? (
        <div className="font-mono text-[10.5px] text-ink-500 mt-0.5">
          {mask ? <MoneyMask>{hint}</MoneyMask> : hint}
        </div>
      ) : null}
    </div>
  );
}
