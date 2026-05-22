import { Panel, PanelHeader } from "@/components/ui/panel";
import { AssetLiveCell } from "./asset-live-cell";
import { AssetDetailPopover } from "./asset-detail-popover";
import { InvestmentRowActions } from "./investment-row-actions";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { ASSET_TYPE_LABELS, type Investment } from "@/services/investments";
import type { LiveAssetMetrics } from "@/lib/financial/live-yield";

type AccountLite = { id: string; name: string; institution: string };

export function VariableIncomeTable({
  investments,
  liveByAssetId,
  investmentAccounts,
}: {
  investments: Investment[];
  liveByAssetId: Map<string, LiveAssetMetrics>;
  investmentAccounts: AccountLite[];
}) {
  if (investments.length === 0) return null;

  // KPIs de variável: mark-to-market
  const aplicado = investments.reduce((s, i) => s + Number(i.initial_amount ?? 0), 0);
  let valorMercado = 0;
  let dividendoMensal = 0;
  for (const inv of investments) {
    const live = liveByAssetId.get(inv.id);
    valorMercado += live?.marketBalance ?? Number(inv.current_balance ?? 0);
    dividendoMensal += (live?.dailyYield ?? 0) * 21;
  }
  const ganho = valorMercado - aplicado;
  const ganhoPct = aplicado > 0 ? ganho / aplicado : 0;
  const dyAnnualPct = valorMercado > 0 ? (dividendoMensal * 12) / valorMercado : 0;

  return (
    <section className="mb-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Aplicado (custo)" value={formatMoney(aplicado)} />
        <Stat
          label="A mercado"
          value={formatMoney(valorMercado)}
          hint={
            aplicado > 0
              ? `${ganho >= 0 ? "+" : ""}${formatMoney(ganho)} (${formatPercent(ganhoPct, 2)})`
              : undefined
          }
          tone={ganho > 0 ? "positive" : ganho < 0 ? "negative" : "default"}
        />
        <Stat
          label="Dividendo médio/mês"
          value={formatMoney(dividendoMensal)}
          hint="estimado pela média 12m"
          tone={dividendoMensal > 0 ? "positive" : "default"}
        />
        <Stat
          label="DY anualizado"
          value={dyAnnualPct > 0 ? formatPercent(dyAnnualPct, 1) : "—"}
          hint="dividendos / valor a mercado"
        />
      </div>

      <Panel className="!px-0">
        <div className="px-7">
          <PanelHeader
            title="Renda variável"
            meta={`${investments.length} ativo${investments.length !== 1 ? "s" : ""} · FII, ações, ETF, cripto`}
          />
        </div>

        <div className="overflow-x-auto px-7">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Ativo</Th>
                <Th right>Qtd</Th>
                <Th right>Preço médio</Th>
                <Th right>Cotação</Th>
                <Th right>A mercado</Th>
                <Th right>Variação</Th>
                <Th right>Dividendo (12m)</Th>
                <th className="w-9" />
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {investments.map((inv) => {
                const live = liveByAssetId.get(inv.id);
                const isCrypto = inv.asset_type === "crypto";
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors group"
                  >
                    <td className="py-3.5 pr-4 align-middle">
                      <div className="font-mono text-[13.5px] font-medium tracking-[-0.01em]">
                        {inv.ticker}
                      </div>
                      <div className="font-mono text-[10.5px] text-faint-foreground uppercase tracking-[0.1em] mt-0.5">
                        {ASSET_TYPE_LABELS[inv.asset_type]}
                      </div>
                    </td>
                    <td className="text-right font-mono text-[12.5px]">
                      {live?.quantity != null && live.quantity > 0 ? (
                        <>
                          {live.quantity.toLocaleString("pt-BR", {
                            maximumFractionDigits: 8,
                          })}
                          <div className="text-faint-foreground text-[10px] mt-0.5">
                            {isCrypto ? "un" : "cotas"}
                          </div>
                        </>
                      ) : (
                        <span className="text-faint-foreground">—</span>
                      )}
                    </td>
                    <td className="text-right font-mono text-[12.5px] text-muted-foreground">
                      {live?.averagePrice && live.averagePrice > 0
                        ? formatMoney(live.averagePrice)
                        : "—"}
                    </td>
                    <td className="text-right font-mono text-[12.5px]">
                      {live?.marketPrice != null ? (
                        <>
                          {formatMoney(live.marketPrice)}
                          {live.marketChangePct != null &&
                          Math.abs(live.marketChangePct) > 0.001 ? (
                            <div
                              className={`text-[10px] mt-0.5 ${
                                live.marketChangePct > 0
                                  ? "text-olive-700 dark:text-olive-500"
                                  : "text-rust-600"
                              }`}
                            >
                              {live.marketChangePct > 0 ? "+" : ""}
                              {live.marketChangePct.toFixed(2).replace(".", ",")}% dia
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-faint-foreground">—</span>
                      )}
                    </td>
                    <td className="text-right font-mono text-[13px] font-medium">
                      {formatMoney(live?.marketBalance ?? Number(inv.current_balance))}
                    </td>
                    <td className="text-right font-mono text-[12.5px]">
                      {live?.marketGain != null ? (
                        <>
                          <span
                            className={
                              live.marketGain > 0
                                ? "text-olive-700 dark:text-olive-500"
                                : live.marketGain < 0
                                  ? "text-rust-600"
                                  : "text-faint-foreground"
                            }
                          >
                            {live.marketGain >= 0 ? "+" : ""}
                            {formatPercent(live.marketGainPct ?? 0, 2)}
                          </span>
                          <div
                            className={`text-[10px] mt-0.5 font-mono ${
                              live.marketGain > 0
                                ? "text-olive-700 dark:text-olive-500"
                                : live.marketGain < 0
                                  ? "text-rust-600"
                                  : "text-faint-foreground"
                            }`}
                          >
                            {live.marketGain >= 0 ? "+" : ""}
                            {formatMoney(live.marketGain)}
                          </div>
                        </>
                      ) : (
                        <span className="text-faint-foreground">—</span>
                      )}
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
