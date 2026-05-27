"use client";

import type { LivePortfolio } from "@/lib/financial/live-yield";
import { formatMoney, formatMoneyParts, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  useComparisonCurrency,
  useDisplayCurrency,
  useMoneyContext,
} from "@/components/ui/money-provider";
import { convert, CURRENCY_SYMBOLS, formatCurrency } from "@/lib/financial/currency";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * Card de rendimento do portfólio.
 *  - "compact": versão pro dashboard
 *  - "full": versão grande pra /investimentos
 *
 * Mostra o rendimento acumulado LIFETIME (desde a compra dos ativos) como
 * número estático. Selic/Tesouro rendem em incrementos DIÁRIOS na vida
 * real — não tem ticker por segundo, é interpolação visual mentirosa.
 *
 * Atualiza 1× por dia útil quando o cron sync-tesouro-prices + update-balances
 * rodam (06h BRT). Pulsinho verde animado fica só pelo charme do "vivo".
 */
export function PortfolioLiveTicker({
  portfolio,
  variant = "compact",
}: {
  portfolio: LivePortfolio;
  variant?: "compact" | "full";
}) {
  const displayCurrency = useDisplayCurrency();
  const comparisonCurrency = useComparisonCurrency();
  const { rates } = useMoneyContext();
  const symbol = CURRENCY_SYMBOLS[displayCurrency];

  // Valor estático — vem do server-side com today's fraction já incluída
  // no derivedBalance. Refresh da página re-busca; sem timer no client.
  const accumulatedToday = portfolio.totalFixedIncomeAccumulatedYield;
  const ratioMarket = portfolio.totalMarketBalance / Math.max(1, portfolio.totalBaseBalance);

  // Comparação — converte accumulatedToday e patrimônio pra moeda de comparação
  const compEnabled = comparisonCurrency != null && comparisonCurrency !== displayCurrency;
  const accumulatedComp = compEnabled
    ? convert(accumulatedToday, displayCurrency, comparisonCurrency, rates)
    : null;
  const patrimonioComp = compEnabled
    ? convert(portfolio.totalMarketBalance, displayCurrency, comparisonCurrency, rates)
    : null;

  if (portfolio.byAsset.length === 0) {
    return null;
  }

  if (variant === "compact") {
    return (
      <section className="rounded-[var(--radius-lg)] bg-ink-950 text-white p-6 sm:p-7 mb-6 relative overflow-hidden border border-ink-700">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-12 w-48 h-48"
          style={{ background: "radial-gradient(circle, rgba(59,231,114,0.10), transparent 70%)" }}
        />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 font-medium flex items-center gap-2 mb-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
              Rendimento acumulado
            </div>
            <div className="flex items-baseline gap-3 font-mono">
              <span className="text-[14px] text-navy-300 font-light">{symbol}</span>
              <span className="text-[34px] sm:text-[40px] font-light leading-none tracking-[-0.03em] tabular-nums">
                <MoneyMask>
                  {accumulatedToday.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </MoneyMask>
              </span>
              <span className="text-[12px] text-navy-400 font-mono">lifetime</span>
            </div>
            {accumulatedComp != null && comparisonCurrency ? (
              <div className="font-mono text-[11.5px] text-navy-400 mt-1 tabular-nums">
                ≈ <MoneyMask>{formatCurrency(accumulatedComp, comparisonCurrency)}</MoneyMask>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-3 text-[11.5px] font-mono text-navy-200">
              <Pill>
                Por dia útil{" "}
                <b className="text-olive-500">
                  +<MoneyMask>{formatMoney(portfolio.totalDailyYield, displayCurrency)}</MoneyMask>
                </b>
              </Pill>
              <Pill>
                Carteira <b className="text-white"><MoneyMask>{formatMoney(portfolio.totalMarketBalance, displayCurrency)}</MoneyMask></b>
              </Pill>
              {ratioMarket !== 1 && Math.abs(ratioMarket - 1) > 0.001 ? (
                <Pill>
                  Mercado{" "}
                  <span className={ratioMarket > 1 ? "text-olive-500" : "text-rust-500"}>
                    {ratioMarket > 1 ? "+" : ""}
                    {formatPercent(ratioMarket - 1, 2)}
                  </span>
                </Pill>
              ) : null}
            </div>
          </div>
          <ClassBreakdown portfolio={portfolio} />
        </div>
      </section>
    );
  }

  // ============== variant === "full" ==============
  const { integer, cents } = formatMoneyParts(accumulatedToday, displayCurrency);
  return (
    <section className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-9 sm:p-10 mb-7 relative overflow-hidden shadow-lg border border-ink-700">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2"
        style={{ background: "radial-gradient(circle, rgba(176,123,50,0.06), transparent 60%)" }}
      />
      <div className="relative z-10 grid sm:grid-cols-[1.5fr_auto] gap-8">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 font-medium flex items-center gap-2 mb-3.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
            Rendimento acumulado
          </div>
          <div className="font-display italic text-[20px] tracking-[-0.01em] mb-6 text-navy-200">
            <em>Desde a compra dos ativos — Selic do BCB + PU oficial do Tesouro.</em>
          </div>

          <div className="flex items-baseline gap-3 font-mono">
            <span className="text-[18px] text-navy-300 font-light">{symbol}</span>
            <span className="text-[44px] sm:text-[52px] font-light leading-none tracking-[-0.03em] tabular-nums">
              <MoneyMask>{integer}</MoneyMask>
            </span>
            <span className="text-[22px] text-navy-300 font-light">,<MoneyMask>{cents}</MoneyMask></span>
          </div>
          {accumulatedComp != null && comparisonCurrency ? (
            <div className="font-mono text-[12.5px] text-navy-400 mt-1 tabular-nums">
              ≈ <MoneyMask>{formatCurrency(accumulatedComp, comparisonCurrency)}</MoneyMask>
            </div>
          ) : null}

          <div className="flex gap-2 mt-5 flex-wrap">
            <Pill>
              Estimado por dia útil{" "}
              <b className="text-olive-500"><MoneyMask>{formatMoney(portfolio.totalDailyYield, displayCurrency)}</MoneyMask></b>
            </Pill>
            <Pill>
              Mês estimado{" "}
              <b className="text-olive-500"><MoneyMask>{formatMoney(portfolio.totalDailyYield * 21, displayCurrency)}</MoneyMask></b>
            </Pill>
            <Pill>
              Próximo update <span className="text-navy-300">amanhã 06h BRT</span>
            </Pill>
          </div>
        </div>

        <div className="sm:pl-9 sm:border-l border-ink-700 grid gap-4 content-start min-w-[220px]">
          <SideCell
            label="Patrimônio total"
            value={formatMoney(portfolio.totalMarketBalance, displayCurrency)}
            hint={
              patrimonioComp != null && comparisonCurrency
                ? `≈ ${formatCurrency(patrimonioComp, comparisonCurrency)}`
                : Math.abs(portfolio.totalMarketBalance - portfolio.totalBaseBalance) > 1
                  ? `Custo: ${formatMoney(portfolio.totalBaseBalance, displayCurrency)}`
                  : undefined
            }
            mask
          />
          <SideCell
            label="Renda fixa"
            value={formatMoney(portfolio.byClass.fixedIncome.dailyYield, displayCurrency) + " / dia"}
            tone="positive"
            mask
          />
          {portfolio.byClass.fiis.balance > 0 ? (
            <SideCell
              label="FIIs (estimado)"
              value={formatMoney(portfolio.byClass.fiis.dailyYield, displayCurrency) + " / dia"}
              tone="positive"
              mask
            />
          ) : null}
          {portfolio.byClass.stocks.balance > 0 ? (
            <SideCell
              label="Ações/ETFs (estimado)"
              value={formatMoney(portfolio.byClass.stocks.dailyYield, displayCurrency) + " / dia"}
              tone="positive"
              mask
            />
          ) : null}
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

function ClassBreakdown({ portfolio }: { portfolio: LivePortfolio }) {
  const items = [
    { label: "Renda fixa", value: portfolio.byClass.fixedIncome.dailyYield },
    { label: "FIIs", value: portfolio.byClass.fiis.dailyYield },
    { label: "Ações/ETFs", value: portfolio.byClass.stocks.dailyYield },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-1 text-[11px] font-mono">
      {items.map((i) => (
        <div key={i.label} className="flex justify-between gap-3 text-navy-300">
          <span>{i.label}</span>
          <span className="text-olive-500">
            + <MoneyMask>{i.value.toFixed(2).replace(".", ",")}</MoneyMask>/dia
          </span>
        </div>
      ))}
    </div>
  );
}
