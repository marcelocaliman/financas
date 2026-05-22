import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { PortfolioLiveTicker } from "@/components/investments/portfolio-live-ticker";
import { AssetLiveCell } from "@/components/investments/asset-live-cell";
import { AssetDetailPopover } from "@/components/investments/asset-detail-popover";
import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { InvestmentRowActions } from "@/components/investments/investment-row-actions";
import { listAccounts } from "@/services/accounts";
import {
  ASSET_TYPE_LABELS,
  getCoverage,
  getPortfolioStats,
  listInvestments,
} from "@/services/investments";
import { getLivePortfolio } from "@/services/live-yield";
import { formatMoney, formatPercent } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function InvestimentosPage() {
  const [investments, stats, coverage, accounts, live] = await Promise.all([
    listInvestments(),
    getPortfolioStats(),
    getCoverage(),
    listAccounts(),
    getLivePortfolio(),
  ]);

  const investmentAccounts = accounts
    .filter((a) => a.type === "investment")
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));

  const liveByAssetId = new Map(live.byAsset.map((a) => [a.id, a]));

  return (
    <>
      <PageHeader
        eyebrow={`Patrimônio · ${investments.length} ativo${investments.length !== 1 ? "s" : ""}`}
        title={
          <>
            A carteira <em className="not-italic font-display italic text-navy-700">respirando.</em>
          </>
        }
        subtitle="Os ativos atualizam diariamente com a Selic do Banco Central."
        actions={<NewInvestmentButton investmentAccounts={investmentAccounts} />}
      />

      {investments.length === 0 ? (
        <EmptyState hasInvestmentAccounts={investmentAccounts.length > 0} />
      ) : (
        <>
          <PortfolioLiveTicker portfolio={live} variant="full" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            <StatCard label="Patrimônio total" value={formatMoney(stats.total)} />
            <StatCard
              label="Aplicado"
              value={formatMoney(stats.invested)}
              hint={
                stats.invested > 0
                  ? `↑ ${formatMoney(stats.total - stats.invested)} no agregado`
                  : undefined
              }
              tone="positive"
            />
            <StatCard
              label="Renda média / mês"
              value={formatMoney(coverage.monthlyAverageYield)}
              hint="média 3 meses líquida"
            />
            <StatCard
              label="Cobertura"
              value={formatPercent(coverage.ratio, 0)}
              hint={`${formatMoney(coverage.monthlyAverageExpense)} despesa média`}
              tone={coverage.ratio >= 1 ? "positive" : "default"}
            />
          </div>

          <Panel className="!px-0">
            <div className="px-7">
              <PanelHeader
                title="Ativos"
                meta={`${investments.length} ativo${investments.length !== 1 ? "s" : ""}`}
              />
            </div>

            <div className="overflow-x-auto px-7">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <Th>Ativo</Th>
                    <Th right>Aplicado</Th>
                    <Th right>Preço médio</Th>
                    <Th right>Valor atual</Th>
                    <Th right>Variação</Th>
                    <Th right>Rendendo hoje</Th>
                    <Th right>Indexador</Th>
                    <th className="w-9" />
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => {
                    const liveAsset = liveByAssetId.get(inv.id);
                    const valueAtual =
                      liveAsset?.marketBalance != null && liveAsset.marketBalance > 0
                        ? liveAsset.marketBalance
                        : Number(inv.current_balance);
                    // Variação prioriza market gain (B3) sobre delta do custo
                    const deltaPct =
                      liveAsset?.marketGainPct != null
                        ? liveAsset.marketGainPct
                        : Number(inv.initial_amount) > 0
                          ? (Number(inv.current_balance) - Number(inv.initial_amount)) /
                            Number(inv.initial_amount)
                          : 0;
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors group"
                      >
                        <td className="py-3.5 pr-4 align-middle">
                          <div className="font-mono text-[13.5px] font-medium tracking-[-0.01em] flex items-center gap-2">
                            {liveAsset && liveAsset.dailyYield > 0 ? (
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
                        <td className="text-right font-mono text-[12.5px]">
                          {liveAsset?.averagePrice != null && liveAsset.averagePrice > 0 ? (
                            <>
                              <div>{formatMoney(liveAsset.averagePrice)}</div>
                              {liveAsset.quantity != null && liveAsset.quantity > 0 ? (
                                <div className="text-faint-foreground text-[10.5px] mt-0.5">
                                  {liveAsset.quantity.toLocaleString("pt-BR", {
                                    maximumFractionDigits: 8,
                                  })}{" "}
                                  {inv.asset_type === "crypto" ? "un" : "cotas"}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-faint-foreground">—</span>
                          )}
                        </td>
                        <td className="text-right font-mono text-[13px] font-medium">
                          {formatMoney(valueAtual)}
                          {liveAsset?.marketPrice != null ? (
                            <div className="text-faint-foreground text-[10.5px] font-mono mt-0.5">
                              cotação {formatMoney(liveAsset.marketPrice)}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-right font-mono text-[12.5px]">
                          {deltaPct > 0 ? (
                            <span className="text-olive-700 dark:text-olive-500">
                              +{formatPercent(deltaPct, 2)}
                            </span>
                          ) : deltaPct < 0 ? (
                            <span className="text-rust-600">{formatPercent(deltaPct, 2)}</span>
                          ) : (
                            <span className="text-faint-foreground">—</span>
                          )}
                          {liveAsset?.marketGain != null ? (
                            <div
                              className={`text-[10.5px] mt-0.5 font-mono ${
                                liveAsset.marketGain > 0
                                  ? "text-olive-700 dark:text-olive-500"
                                  : liveAsset.marketGain < 0
                                    ? "text-rust-600"
                                    : "text-faint-foreground"
                              }`}
                            >
                              {liveAsset.marketGain >= 0 ? "+" : ""}
                              {formatMoney(liveAsset.marketGain)}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-right pl-2">
                          {liveAsset ? <AssetLiveCell asset={liveAsset} /> : "—"}
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
                        <td className="text-right pl-1">
                          {liveAsset ? <AssetDetailPopover asset={liveAsset} /> : null}
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
          </Panel>

          <p className="text-[10.5px] font-mono text-faint-foreground tracking-[0.06em] mt-4">
            Saldos recalculados automaticamente toda manhã (cron Vercel + BCB).
          </p>
        </>
      )}
    </>
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

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="rounded-[var(--radius)] bg-surface border border-border px-5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[22px] tracking-[-0.02em] text-foreground">
        {value}
      </div>
      {hint ? (
        <div
          className={`mt-1 font-mono text-[11.5px] ${tone === "positive" ? "text-olive-700" : "text-muted-foreground"}`}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ hasInvestmentAccounts }: { hasInvestmentAccounts: boolean }) {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[480px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Carteira vazia
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2 text-foreground">
          {hasInvestmentAccounts
            ? "Nenhum ativo cadastrado ainda."
            : "Cadastre uma corretora primeiro."}
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          {hasInvestmentAccounts
            ? "Use “Novo ativo” acima para registrar seu primeiro Tesouro, FII ou CDB."
            : "Vai em /contas e crie uma conta do tipo investimento (XP, Rico, Inter…)."}
        </p>
      </div>
    </Panel>
  );
}
