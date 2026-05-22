import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { AssetLiveCell } from "./asset-live-cell";
import { AssetDetailPopover } from "./asset-detail-popover";
import { InvestmentRowActions } from "./investment-row-actions";
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

  // KPIs de renda fixa
  const aplicado = investments.reduce((s, i) => s + Number(i.initial_amount ?? 0), 0);
  const saldo = investments.reduce((s, i) => s + Number(i.current_balance ?? 0), 0);
  const ganho = saldo - aplicado;
  const ganhoPct = aplicado > 0 ? ganho / aplicado : 0;
  const rendaDiaria = investments.reduce(
    (s, i) => s + (liveByAssetId.get(i.id)?.dailyYield ?? 0),
    0,
  );
  const rendaMensal = rendaDiaria * 21;

  return (
    <section className="mb-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Aplicado" value={formatMoney(aplicado)} />
        <Stat
          label="Saldo atual"
          value={formatMoney(saldo)}
          hint={
            ganho >= 0
              ? `+${formatMoney(ganho)} (${formatPercent(ganhoPct, 1)})`
              : `${formatMoney(ganho)} (${formatPercent(ganhoPct, 1)})`
          }
          tone={ganho > 0 ? "positive" : ganho < 0 ? "negative" : "default"}
        />
        <Stat
          label="Renda diária est."
          value={formatMoney(rendaDiaria)}
          tone={rendaDiaria > 0 ? "positive" : "default"}
        />
        <Stat
          label="Renda mensal est."
          value={formatMoney(rendaMensal)}
          tone={rendaMensal > 0 ? "positive" : "default"}
        />
      </div>

      <Panel className="!px-0">
        <div className="px-7">
          <PanelHeader
            title="Renda fixa"
            meta={`${investments.length} ativo${investments.length !== 1 ? "s" : ""} · Tesouro, CDB, LCI, LCA…`}
          />
        </div>

        <div className="overflow-x-auto px-7">
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
                const delta = Number(inv.current_balance) - Number(inv.initial_amount);
                const deltaPct =
                  Number(inv.initial_amount) > 0 ? delta / Number(inv.initial_amount) : 0;
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
                    <td className="text-right font-mono text-[13px] font-medium">
                      {formatMoney(inv.current_balance)}
                    </td>
                    <td className="text-right font-mono text-[12.5px]">
                      {delta > 0 ? (
                        <span className="text-olive-700 dark:text-olive-500">
                          +{formatPercent(deltaPct, 2)}
                        </span>
                      ) : delta < 0 ? (
                        <span className="text-rust-600">{formatPercent(deltaPct, 2)}</span>
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
      </Panel>
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

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="rounded-[var(--radius)] bg-surface border border-border px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div className="mt-1 font-mono text-[17px] tracking-[-0.02em] text-foreground">
        {value}
      </div>
      {hint ? (
        <div
          className={`mt-0.5 font-mono text-[11px] ${
            tone === "positive"
              ? "text-olive-700 dark:text-olive-500"
              : tone === "negative"
                ? "text-rust-600"
                : "text-muted-foreground"
          }`}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
