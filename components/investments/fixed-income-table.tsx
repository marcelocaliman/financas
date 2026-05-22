import { AssetLiveCell } from "./asset-live-cell";
import { AssetDetailPopover } from "./asset-detail-popover";
import { InvestmentRowActions } from "./investment-row-actions";
import { LiveSaldoCell, LiveVariationCell } from "./fixed-income-row-live";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { ASSET_TYPE_LABELS, type Investment } from "@/services/investments";
import type { LiveAssetMetrics } from "@/lib/financial/live-yield";

type AccountLite = { id: string; name: string; institution: string };

export function FixedIncomeTable({
  investments,
  liveByAssetId,
  investmentAccounts,
}: {
  investments: Investment[];
  liveByAssetId: Map<string, LiveAssetMetrics>;
  investmentAccounts: AccountLite[];
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
      <header className="px-7 pt-7 pb-6 border-b border-border bg-gradient-to-b from-navy-50/40 to-transparent dark:from-navy-900/20">
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
            <div className="font-mono text-[24px] tracking-[-0.025em] text-foreground mt-0.5 tabular-nums">
              {formatMoney(saldo)}
            </div>
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
                {formatMoney(ganho)} ({formatPercent(ganhoPct, 2)})
              </div>
            ) : null}
          </div>
        </div>

        {/* KPIs internos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-6 pt-5 border-t border-border">
          <MiniStat label="Aplicado" value={formatMoney(aplicado)} />
          <MiniStat
            label="Renda diária"
            value={formatMoney(rendaDiaria)}
            tone={rendaDiaria > 0 ? "positive" : "default"}
          />
          <MiniStat
            label="Renda mensal estimada"
            value={formatMoney(rendaMensal)}
            tone={rendaMensal > 0 ? "positive" : "default"}
          />
          <MiniStat
            label="Renda anual estimada"
            value={formatMoney(rendaDiaria * 252)}
            tone={rendaDiaria > 0 ? "positive" : "default"}
          />
        </div>
      </header>

      {/* Tabela */}
      <div className="overflow-x-auto px-7 py-2">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <Th>Ativo</Th>
              <Th right>Aplicado</Th>
              <Th right>Saldo atual</Th>
              <Th right>Variação</Th>
              <Th right>Indexador</Th>
              <Th right>Rendendo hoje</Th>
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
                    {formatMoney(inv.initial_amount)}
                  </td>
                  <td className="text-right">
                    {live ? (
                      <LiveSaldoCell asset={live} fallback={fallbackSaldo} />
                    ) : (
                      <span className="font-mono text-[13px] font-medium tabular-nums">
                        {formatMoney(fallbackSaldo)}
                      </span>
                    )}
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
                          {formatMoney(fallbackDelta)}
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
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div
        className={`font-mono text-[14px] tracking-[-0.01em] mt-0.5 tabular-nums ${
          tone === "positive" ? "text-olive-700 dark:text-olive-500" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
