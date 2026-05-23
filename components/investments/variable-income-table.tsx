import { Money } from "@/components/ui/money";
import { MoneyMask } from "@/components/ui/privacy-provider";
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
  portfolioTotal = 0,
}: {
  investments: Investment[];
  liveByAssetId: Map<string, LiveAssetMetrics>;
  investmentAccounts: AccountLite[];
  portfolioTotal?: number;
}) {
  if (investments.length === 0) return null;

  const aplicado = investments.reduce(
    (s, i) => s + Number(i.initial_amount ?? 0),
    0,
  );
  let valorMercado = 0;
  let dividendoMensal = 0;
  for (const inv of investments) {
    const live = liveByAssetId.get(inv.id);
    valorMercado += live?.marketBalance ?? live?.baseBalance ?? Number(inv.current_balance);
    dividendoMensal += (live?.dailyYield ?? 0) * 21;
  }
  const ganho = valorMercado - aplicado;
  const ganhoPct = aplicado > 0 ? ganho / aplicado : 0;
  const dyAnnualPct = valorMercado > 0 ? (dividendoMensal * 12) / valorMercado : 0;

  return (
    <section className="rounded-[var(--radius-xl)] border border-border bg-surface mb-8 overflow-hidden">
      <header className="px-4 pt-5 pb-5 sm:px-7 sm:pt-7 sm:pb-6 border-b border-border bg-gradient-to-b from-gold-100/30 to-transparent dark:from-gold-700/10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-gold-700 dark:text-gold-500 font-medium mb-1.5">
              Classe · {investments.length} ativo{investments.length !== 1 ? "s" : ""}
            </div>
            <h2 className="font-display text-[26px] tracking-[-0.025em] text-foreground">
              Renda <em className="italic">variável</em>
            </h2>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              Ações, FIIs, ETFs e cripto — cotação ao vivo via brapi.dev, dividendos pela média 12m.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-faint-foreground font-medium">
              A mercado
            </div>
            <Money
              value={valorMercado}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-6 pt-5 border-t border-border">
          <MiniMoney label="Aplicado (custo)" value={aplicado} />
          <MiniMoney
            label="Dividendo médio/mês"
            value={dividendoMensal}
            tone={dividendoMensal > 0 ? "positive" : "default"}
            emptyDash={dividendoMensal <= 0}
          />
          <MiniStat
            label="DY anualizado"
            value={dyAnnualPct > 0 ? formatPercent(dyAnnualPct, 2) : "—"}
          />
          <MiniStat
            label="Variação no agregado"
            value={ganho >= 0 ? `+${formatPercent(ganhoPct, 2)}` : formatPercent(ganhoPct, 2)}
            tone={ganho > 0 ? "positive" : "default"}
          />
        </div>
      </header>

      {/* Mobile: cards */}
      <div className="lg:hidden">
        {investments.map((inv) => {
          const live = liveByAssetId.get(inv.id);
          const isCrypto = inv.asset_type === "crypto";
          const marketBalance = live?.marketBalance ?? live?.baseBalance ?? Number(inv.current_balance);
          return (
            <div
              key={inv.id}
              className="px-4 py-4 border-b border-border last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[14px] font-medium tracking-[-0.01em] truncate">
                    {inv.ticker}
                  </div>
                  <div className="font-mono text-[10.5px] text-faint-foreground uppercase tracking-[0.1em] mt-0.5">
                    {ASSET_TYPE_LABELS[inv.asset_type]}
                    {live?.quantity != null && live.quantity > 0 ? (
                      <>
                        <span className="mx-1">·</span>
                        <MoneyMask>
                          {live.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}
                        </MoneyMask>{" "}
                        {isCrypto ? "un" : "cotas"}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-[14.5px] font-medium tabular-nums">
                    <MoneyMask>{formatMoney(marketBalance)}</MoneyMask>
                  </div>
                  {portfolioTotal > 0 ? (
                    <div className="font-mono text-[10.5px] text-faint-foreground tabular-nums mt-0.5">
                      {((marketBalance / portfolioTotal) * 100).toFixed(1).replace(".", ",")}% da carteira
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/60">
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                    Cotação
                  </div>
                  <div className="font-mono text-[12.5px] mt-0.5">
                    {live?.marketPrice != null ? (
                      <MoneyMask>{formatMoney(live.marketPrice)}</MoneyMask>
                    ) : (
                      <span className="text-faint-foreground">—</span>
                    )}
                  </div>
                  {live?.marketChangePct != null && Math.abs(live.marketChangePct) > 0.001 ? (
                    <div
                      className={`font-mono text-[10px] mt-0.5 ${
                        live.marketChangePct > 0
                          ? "text-olive-700 dark:text-olive-500"
                          : "text-rust-600"
                      }`}
                    >
                      {live.marketChangePct > 0 ? "+" : ""}
                      {live.marketChangePct.toFixed(2).replace(".", ",")}% dia
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                    P. médio
                  </div>
                  <div className="font-mono text-[12.5px] text-muted-foreground mt-0.5">
                    {live?.averagePrice && live.averagePrice > 0 ? (
                      <MoneyMask>{formatMoney(live.averagePrice)}</MoneyMask>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                    Variação
                  </div>
                  {live?.marketGain != null ? (
                    <>
                      <div
                        className={`font-mono text-[12.5px] mt-0.5 ${
                          live.marketGain > 0
                            ? "text-olive-700 dark:text-olive-500"
                            : live.marketGain < 0
                              ? "text-rust-600"
                              : "text-faint-foreground"
                        }`}
                      >
                        {live.marketGain >= 0 ? "+" : ""}
                        {formatPercent(live.marketGainPct ?? 0, 2)}
                      </div>
                      <div
                        className={`font-mono text-[10px] mt-0.5 ${
                          live.marketGain > 0
                            ? "text-olive-700 dark:text-olive-500"
                            : live.marketGain < 0
                              ? "text-rust-600"
                              : "text-faint-foreground"
                        }`}
                      >
                        {live.marketGain >= 0 ? "+" : ""}
                        <MoneyMask>{formatMoney(live.marketGain)}</MoneyMask>
                      </div>
                    </>
                  ) : (
                    <span className="text-faint-foreground font-mono text-[12.5px]">—</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/60">
                {live ? <AssetLiveCell asset={live} /> : null}
                {live ? <AssetDetailPopover asset={live} /> : null}
                <InvestmentRowActions
                  investment={inv}
                  investmentAccounts={investmentAccounts}
                />
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
              <Th right>Qtd</Th>
              <Th right>Preço médio</Th>
              <Th right>Cotação</Th>
              <Th right>A mercado</Th>
              <Th right>% carteira</Th>
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
                        <MoneyMask>
                          {live.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}
                        </MoneyMask>
                        <div className="text-faint-foreground text-[10px] mt-0.5">
                          {isCrypto ? "un" : "cotas"}
                        </div>
                      </>
                    ) : (
                      <span className="text-faint-foreground">—</span>
                    )}
                  </td>
                  <td className="text-right font-mono text-[12.5px] text-muted-foreground">
                    {live?.averagePrice && live.averagePrice > 0 ? (
                      <MoneyMask>{formatMoney(live.averagePrice)}</MoneyMask>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right font-mono text-[12.5px]">
                    {live?.marketPrice != null ? (
                      <>
                        <MoneyMask>{formatMoney(live.marketPrice)}</MoneyMask>
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
                  <td className="text-right font-mono text-[13px] font-medium tabular-nums">
                    <MoneyMask>
                      {formatMoney(live?.marketBalance ?? live?.baseBalance ?? Number(inv.current_balance))}
                    </MoneyMask>
                  </td>
                  <td className="text-right font-mono text-[12.5px] text-muted-foreground tabular-nums">
                    {portfolioTotal > 0
                      ? `${(((live?.marketBalance ?? live?.baseBalance ?? Number(inv.current_balance)) / portfolioTotal) * 100).toFixed(1).replace(".", ",")}%`
                      : "—"}
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
                          <MoneyMask>{formatMoney(live.marketGain)}</MoneyMask>
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

function MiniMoney({
  label,
  value,
  tone = "default",
  emptyDash = false,
}: {
  label: string;
  value: number;
  tone?: "default" | "positive";
  emptyDash?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      {emptyDash ? (
        <div className="font-mono text-[14px] tracking-[-0.01em] mt-0.5 text-foreground">—</div>
      ) : (
        <Money
          value={value}
          showComparison
          className={`text-[14px] tracking-[-0.01em] mt-0.5 items-start ${
            tone === "positive" ? "text-olive-700 dark:text-olive-500" : "text-foreground"
          }`}
          secondaryClassName="text-[10px]"
        />
      )}
    </div>
  );
}
