import { AssetLiveCell } from "./asset-live-cell";
import { AssetDetailPopover } from "./asset-detail-popover";
import { InvestmentRowActions } from "./investment-row-actions";
import { LiveSaldoCell, LiveVariationCell } from "./fixed-income-row-live";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { ASSET_TYPE_LABELS, type Investment } from "@/services/investments";
import type { LiveAssetMetrics } from "@/lib/financial/live-yield";

type AccountLite = { id: string; name: string; institution: string };

export function FixedIncomeTable({
  investments,
  liveByAssetId,
  investmentAccounts,
  destinationAccounts = [],
  portfolioTotal = 0,
}: {
  investments: Investment[];
  liveByAssetId: Map<string, LiveAssetMetrics>;
  investmentAccounts: AccountLite[];
  /** Contas pra receber saques de rendimento (não-investment) */
  destinationAccounts?: AccountLite[];
  /** Total geral da carteira, pra calcular % de cada ativo */
  portfolioTotal?: number;
}) {
  if (investments.length === 0) return null;

  // KPIs usam saldo DERIVADO (composto desde a compra), não o checkpoint
  const aplicado = investments.reduce(
    (s, i) => s + Number(i.initial_amount ?? 0),
    0,
  );
  const saldo = investments.reduce(
    (s, i) => s + (liveByAssetId.get(i.id)?.baseBalance ?? Number(i.current_balance)),
    0,
  );
  const ganho = saldo - aplicado;
  const ganhoPct = aplicado > 0 ? ganho / aplicado : 0;
  const rendaDiaria = investments.reduce(
    (s, i) => s + (liveByAssetId.get(i.id)?.dailyYield ?? 0),
    0,
  );
  const rendaMensal = rendaDiaria * 21;

  return (
    <section className="rounded-[var(--radius-xl)] border border-border bg-surface mb-8 overflow-hidden">
      {/* Header da ilha */}
      <header className="px-4 pt-5 pb-5 sm:px-7 sm:pt-7 sm:pb-6 border-b border-border bg-gradient-to-b from-navy-50/40 to-transparent dark:from-navy-900/20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-700 dark:text-navy-300 font-medium mb-1.5">
              Classe · {investments.length} ativo{investments.length !== 1 ? "s" : ""}
            </div>
            <h2 className="font-display text-[26px] tracking-[-0.025em] text-foreground">
              Renda <em className="italic">fixa</em>
            </h2>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              Tesouro, CDB, LCI, LCA — rendimento composto pela Selic/CDI/IPCA do BCB.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-faint-foreground font-medium">
              Saldo total
            </div>
            <Money
              value={saldo}
              showComparison
              className="text-[24px] tracking-[-0.025em] text-foreground mt-0.5 items-end"
              secondaryClassName="text-[11.5px]"
            />
            {aplicado > 0 ? (
              <div
                className={`font-mono text-[11.5px] mt-0.5 ${
                  ganho > 0
                    ? "text-olive-700 dark:text-olive-500"
                    : ganho < 0
                      ? "text-rust-600"
                      : "text-muted-foreground"
                }`}
              >
                {ganho >= 0 ? "+" : ""}
                <MoneyMask>{formatMoney(ganho)}</MoneyMask> ({formatPercent(ganhoPct, 2)})
              </div>
            ) : null}
          </div>
        </div>

        {/* KPIs internos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-6 pt-5 border-t border-border">
          <MiniStat label="Aplicado" value={aplicado} />
          <MiniStat
            label="Renda diária"
            value={rendaDiaria}
            tone={rendaDiaria > 0 ? "positive" : "default"}
          />
          <MiniStat
            label="Renda mensal estimada"
            value={rendaMensal}
            tone={rendaMensal > 0 ? "positive" : "default"}
          />
          <MiniStat
            label="Renda anual estimada"
            value={rendaDiaria * 252}
            tone={rendaDiaria > 0 ? "positive" : "default"}
          />
        </div>
      </header>

      {/* Mobile: cards */}
      <div className="lg:hidden">
        {investments.map((inv) => {
          const live = liveByAssetId.get(inv.id);
          const fallbackSaldo = live?.baseBalance ?? Number(inv.current_balance);
          const fallbackDelta = fallbackSaldo - Number(inv.initial_amount);
          const fallbackDeltaPct =
            Number(inv.initial_amount) > 0 ? fallbackDelta / Number(inv.initial_amount) : 0;
          return (
            <div
              key={inv.id}
              className="px-4 py-4 border-b border-border last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[14px] font-medium tracking-[-0.01em] flex items-center gap-2">
                    {live && live.dailyYield > 0 ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse shrink-0" />
                    ) : null}
                    <span className="truncate">{inv.ticker}</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-faint-foreground uppercase tracking-[0.1em] mt-0.5">
                    {ASSET_TYPE_LABELS[inv.asset_type]}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {live ? (
                    <LiveSaldoCell asset={live} fallback={fallbackSaldo} />
                  ) : (
                    <span className="font-mono text-[14.5px] font-medium tabular-nums">
                      <MoneyMask>{formatMoney(fallbackSaldo)}</MoneyMask>
                    </span>
                  )}
                  {portfolioTotal > 0 ? (
                    <div className="font-mono text-[10.5px] text-faint-foreground tabular-nums mt-0.5">
                      {((fallbackSaldo / portfolioTotal) * 100).toFixed(1).replace(".", ",")}% da carteira
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/60">
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                    Aplicado
                  </div>
                  <div className="font-mono text-[12.5px] text-muted-foreground mt-0.5">
                    <MoneyMask>{formatMoney(inv.initial_amount)}</MoneyMask>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                    Variação
                  </div>
                  {live ? (
                    <LiveVariationCell
                      asset={live}
                      initialAmount={Number(inv.initial_amount)}
                    />
                  ) : Math.abs(fallbackDelta) > 0.005 ? (
                    <div
                      className={`font-mono text-[12.5px] mt-0.5 ${
                        fallbackDelta > 0
                          ? "text-olive-700 dark:text-olive-500"
                          : "text-rust-600"
                      }`}
                    >
                      {fallbackDelta > 0 ? "+" : ""}
                      {formatPercent(fallbackDeltaPct, 2)}
                    </div>
                  ) : (
                    <span className="text-faint-foreground font-mono text-[12.5px]">—</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/60">
                <Badge tone="navy">
                  {inv.indexer === "selic" || inv.indexer === "cdi"
                    ? `${Math.round((Number(inv.indexer_multiplier ?? 1)) * 100)}% ${inv.indexer.toUpperCase()}`
                    : inv.indexer === "fixed"
                      ? `${inv.fixed_rate ?? 0}% a.a.`
                      : inv.indexer === "ipca"
                        ? `IPCA + ${inv.fixed_rate ?? 0}%`
                        : "—"}
                </Badge>
                <div className="flex items-center gap-1">
                  {live ? <AssetLiveCell asset={live} /> : null}
                  {live ? <AssetDetailPopover asset={live} /> : null}
                  <InvestmentRowActions
                    investment={inv}
                    investmentAccounts={investmentAccounts}
                    destinationAccounts={destinationAccounts}
                    accumulatedYield={
                      (live?.baseBalance ?? Number(inv.current_balance)) -
                      Number(inv.initial_amount)
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Tabela */}
      <div className="hidden lg:block overflow-x-auto px-7 py-2">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <Th>Ativo</Th>
              <Th right>Aplicado</Th>
              <Th right>Saldo atual</Th>
              <Th right>% carteira</Th>
              <Th right>Variação</Th>
              <Th right>Indexador</Th>
              <Th right>Acumulado · vivo</Th>
              <th className="w-9" />
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => {
              const live = liveByAssetId.get(inv.id);
              const fallbackSaldo = live?.baseBalance ?? Number(inv.current_balance);
              const fallbackDelta = fallbackSaldo - Number(inv.initial_amount);
              const fallbackDeltaPct =
                Number(inv.initial_amount) > 0
                  ? fallbackDelta / Number(inv.initial_amount)
                  : 0;
              return (
                <tr
                  key={inv.id}
                  className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors group"
                >
                  <td className="py-3.5 pr-4 align-middle">
                    <div className="font-mono text-[13.5px] font-medium tracking-[-0.01em] flex items-center gap-2">
                      {live && live.dailyYield > 0 ? (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
                      ) : null}
                      {inv.ticker}
                    </div>
                    <div className="font-mono text-[10.5px] text-faint-foreground uppercase tracking-[0.1em] mt-0.5">
                      {ASSET_TYPE_LABELS[inv.asset_type]}
                    </div>
                  </td>
                  <td className="text-right font-mono text-[13px] text-muted-foreground">
                    <MoneyMask>{formatMoney(inv.initial_amount)}</MoneyMask>
                  </td>
                  <td className="text-right">
                    {live ? (
                      <LiveSaldoCell asset={live} fallback={fallbackSaldo} />
                    ) : (
                      <span className="font-mono text-[13px] font-medium tabular-nums">
                        <MoneyMask>{formatMoney(fallbackSaldo)}</MoneyMask>
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono text-[12.5px] text-muted-foreground tabular-nums">
                    {portfolioTotal > 0
                      ? `${((fallbackSaldo / portfolioTotal) * 100).toFixed(1).replace(".", ",")}%`
                      : "—"}
                  </td>
                  <td className="text-right">
                    {live ? (
                      <LiveVariationCell
                        asset={live}
                        initialAmount={Number(inv.initial_amount)}
                      />
                    ) : Math.abs(fallbackDelta) > 0.005 ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span
                          className={`font-mono text-[12.5px] font-medium ${
                            fallbackDelta > 0
                              ? "text-olive-700 dark:text-olive-500"
                              : "text-rust-600"
                          }`}
                        >
                          {fallbackDelta > 0 ? "+" : ""}
                          {formatPercent(fallbackDeltaPct, 2)}
                        </span>
                        <span
                          className={`font-mono text-[10.5px] mt-0.5 tabular-nums ${
                            fallbackDelta > 0
                              ? "text-olive-700 dark:text-olive-500"
                              : "text-rust-600"
                          }`}
                        >
                          {fallbackDelta > 0 ? "+" : ""}
                          <MoneyMask>{formatMoney(fallbackDelta)}</MoneyMask>
                        </span>
                      </div>
                    ) : (
                      <span className="text-faint-foreground font-mono text-[12.5px]">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Badge tone="navy">
                      {inv.indexer === "selic" || inv.indexer === "cdi"
                        ? `${Math.round((Number(inv.indexer_multiplier ?? 1)) * 100)}% ${inv.indexer.toUpperCase()}`
                        : inv.indexer === "fixed"
                          ? `${inv.fixed_rate ?? 0}% a.a.`
                          : inv.indexer === "ipca"
                            ? `IPCA + ${inv.fixed_rate ?? 0}%`
                            : "—"}
                    </Badge>
                  </td>
                  <td className="text-right pl-2">
                    {live ? <AssetLiveCell asset={live} /> : "—"}
                  </td>
                  <td className="text-right pl-1">
                    {live ? <AssetDetailPopover asset={live} /> : null}
                  </td>
                  <td className="text-right pl-1">
                    <InvestmentRowActions
                      investment={inv}
                      investmentAccounts={investmentAccounts}
                      destinationAccounts={destinationAccounts}
                      accumulatedYield={
                        (live?.baseBalance ?? Number(inv.current_balance)) -
                        Number(inv.initial_amount)
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground py-3 font-medium ${right ? "text-right pl-4" : "text-left pr-4"}`}
    >
      {children}
    </th>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive";
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <Money
        value={value}
        showComparison
        className={`text-[14px] tracking-[-0.01em] mt-0.5 items-start ${
          tone === "positive" ? "text-olive-700 dark:text-olive-500" : "text-foreground"
        }`}
        secondaryClassName="text-[10px]"
      />
    </div>
  );
}
