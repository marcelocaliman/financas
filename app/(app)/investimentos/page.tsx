import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { SelicLive } from "@/components/investments/selic-live";
import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { listAccounts } from "@/services/accounts";
import {
  ASSET_TYPE_LABELS,
  getCoverage,
  getLatestIndexer,
  getPortfolioStats,
  listInvestments,
} from "@/services/investments";
import { formatMoney, formatPercent } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function InvestimentosPage() {
  const [investments, stats, coverage, selic, accounts] = await Promise.all([
    listInvestments(),
    getPortfolioStats(),
    getCoverage(),
    getLatestIndexer("selic"),
    listAccounts(),
  ]);

  const investmentAccounts = accounts
    .filter((a) => a.type === "investment")
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));

  const selicValue = selic?.value ?? 0;

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
          {stats.liveAsset && selic ? (
            <SelicLive asset={stats.liveAsset} selicAnnualPct={selicValue} selicDate={selic.date} />
          ) : null}

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
                    <Th right>Valor atual</Th>
                    <Th right>Variação</Th>
                    <Th right>Indexador</Th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => {
                    const delta = Number(inv.current_balance) - Number(inv.initial_amount);
                    const deltaPct =
                      Number(inv.initial_amount) > 0
                        ? delta / Number(inv.initial_amount)
                        : 0;
                    return (
                      <tr key={inv.id} className="border-b border-border last:border-b-0 hover:bg-bone-100/40 transition-colors">
                        <td className="py-3.5 pr-4 align-middle">
                          <div className="font-mono text-[13.5px] font-medium tracking-[-0.01em] flex items-center gap-2">
                            {inv.indexer === "selic" ? (
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
                        <td className="text-right font-mono text-[13px] font-medium">
                          {formatMoney(inv.current_balance)}
                        </td>
                        <td className="text-right font-mono text-[12.5px]">
                          {delta > 0 ? (
                            <span className="text-olive-700">+{formatPercent(deltaPct, 1)}</span>
                          ) : delta < 0 ? (
                            <span className="text-rust-600">{formatPercent(deltaPct, 1)}</span>
                          ) : (
                            <span className="text-faint-foreground">—</span>
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
