import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Eyebrow } from "@/components/ui/eyebrow";
import { KpiCard } from "@/components/ui/kpi-card";
import { PhysicalAssetCard } from "@/components/physical-assets/physical-asset-card";
import { NewPhysicalAssetButton } from "./new-asset-button";
import {
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  getPhysicalAssetsTotals,
  listPhysicalAssets,
} from "@/services/physical-assets";
import { getPortfolioStats } from "@/services/investments";
import { getAccountsTotals } from "@/services/accounts";
import type { PhysicalAssetCategory } from "@/types/database";
import { formatPercent } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PatrimonioPage() {
  const [assets, totals, portfolio, accounts] = await Promise.all([
    listPhysicalAssets({ includeArchived: true }),
    getPhysicalAssetsTotals(),
    getPortfolioStats(),
    getAccountsTotals(),
  ]);

  const active = assets.filter((a) => a.is_active);
  const archived = assets.filter((a) => !a.is_active);

  const netWorth =
    accounts.liquidExcludingInvestmentCash + portfolio.total + totals.total;
  const sharePct = netWorth > 0 ? totals.total / netWorth : 0;

  // Categorias com pelo menos 1 ativo, em ordem do total decrescente
  const categoriesOrdered = (Object.entries(totals.byCategory) as Array<
    [PhysicalAssetCategory, number]
  >)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  // Maior valorização e maior desvalorização entre os ativos
  const withDelta = active
    .filter((a) => Number(a.acquired_value ?? 0) > 0)
    .map((a) => {
      const acq = Number(a.acquired_value);
      const cur = Number(a.current_value);
      return { asset: a, delta: cur - acq, pct: (cur - acq) / acq };
    });
  const topGainer = withDelta.slice().sort((a, b) => b.pct - a.pct)[0] ?? null;
  const topLoser =
    withDelta.length > 1
      ? withDelta.slice().sort((a, b) => a.pct - b.pct)[0]
      : null;

  return (
    <>
      <PageHeader
        eyebrow={`Imobilizado · ${totals.count} ${totals.count === 1 ? "bem" : "bens"}`}
        title={
          <>
            O que você <em className="not-italic font-display italic text-navy-700">possui.</em>
          </>
        }
        subtitle="Apartamento, carro, moto, computador, obras, joias. Bens que têm valor mas não rendem automaticamente — entram só no patrimônio total."
        actions={<NewPhysicalAssetButton />}
      />

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* TIER 1 — Totalizador hero */}
          <div className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-8 sm:p-10 mb-6 relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-16 w-[320px] h-[320px]"
              style={{ background: "radial-gradient(circle, rgba(176,123,50,0.16), transparent 70%)" }}
            />
            <div className="relative z-10">
              <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 mb-2.5 font-medium">
                Patrimônio imobilizado total
              </div>
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <div className="font-mono text-[44px] sm:text-[52px] tracking-[-0.03em] leading-none font-light">
                  {formatBRL(totals.total)}
                </div>
                {sharePct > 0 ? (
                  <div className="font-mono text-[12.5px] text-navy-300 tracking-[0.04em]">
                    {(sharePct * 100).toFixed(0)}% do patrimônio total
                  </div>
                ) : null}
              </div>
              {totals.totalAcquired > 0 && totals.deltaPct != null ? (
                <div className="mt-3 inline-flex items-center gap-2 font-mono text-[12.5px]">
                  <span
                    className={
                      totals.delta >= 0
                        ? "text-[#3be772]"
                        : "text-[#e4a395]"
                    }
                  >
                    {totals.delta >= 0 ? "+" : ""}
                    {formatBRL(totals.delta)} ({formatPercent(totals.deltaPct, 1)})
                  </span>
                  <span className="text-navy-400">vs aquisição</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* TIER 2 — KPIs adicionais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
            <KpiCard
              label="Pago na aquisição"
              value={totals.totalAcquired || 0}
              tone={totals.totalAcquired > 0 ? "muted" : "muted"}
              hint={totals.totalAcquired === 0 ? "sem valores de aquisição" : undefined}
            />
            <KpiCard
              label="Δ vs aquisição"
              value={totals.delta}
              tone={
                totals.delta > 0 ? "positive" : totals.delta < 0 ? "negative" : "muted"
              }
              hint={
                totals.deltaPct != null
                  ? `${totals.delta >= 0 ? "+" : ""}${formatPercent(totals.deltaPct, 1)}`
                  : undefined
              }
            />
            <KpiCard
              label="Idade média"
              textValue={
                totals.averageAgeDays != null
                  ? formatAgeYears(totals.averageAgeDays)
                  : "—"
              }
              tone="neutral"
              hint={`${totals.count} ${totals.count === 1 ? "bem" : "bens"}`}
            />
            <KpiCard
              label="Sem atualizar (>1 ano)"
              textValue={`${totals.staleCount}`}
              tone={totals.staleCount > 0 ? "negative" : "muted"}
              hint={
                totals.staleCount > 0
                  ? "considere revisar valor de mercado"
                  : "tudo em dia"
              }
            />
          </div>

          {/* TIER 3 — Composição por categoria com barras */}
          <Panel className="mb-7">
            <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-4">
              Composição por categoria
            </div>
            <ul className="space-y-3">
              {categoriesOrdered.map(([cat, v]) => {
                const pct = totals.total > 0 ? (v / totals.total) * 100 : 0;
                return (
                  <li key={cat}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <div className="text-[13px] font-medium text-foreground inline-flex items-center gap-2">
                        <span className="font-mono text-[14px]">{CATEGORY_ICONS[cat]}</span>
                        {CATEGORY_LABELS[cat]}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[13px] tabular-nums text-foreground">
                          {formatBRL(v)}
                        </span>
                        <span className="font-mono text-[10.5px] text-faint-foreground tabular-nums w-10 text-right">
                          {pct.toFixed(pct >= 10 ? 0 : 1).replace(".", ",")}%
                        </span>
                      </div>
                    </div>
                    <div className="h-[5px] bg-bone-100 dark:bg-ink-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-navy-700 transition-[width] duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* TIER 4 — Insights (top gainer/loser) */}
          {topGainer || topLoser ? (
            <div className="grid sm:grid-cols-2 gap-4 mb-7">
              {topGainer ? (
                <InsightTile
                  label="Maior valorização"
                  name={topGainer.asset.name}
                  pct={topGainer.pct}
                  delta={topGainer.delta}
                  tone="positive"
                />
              ) : null}
              {topLoser && topLoser.pct < 0 ? (
                <InsightTile
                  label="Maior desvalorização"
                  name={topLoser.asset.name}
                  pct={topLoser.pct}
                  delta={topLoser.delta}
                  tone="negative"
                />
              ) : null}
            </div>
          ) : null}

          {/* TIER 5 — Cards individuais */}
          <Eyebrow className="mb-3">Inventário · {active.length}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((a) => (
              <PhysicalAssetCard key={a.id} asset={a} />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 ? (
        <section className="mt-10">
          <Eyebrow className="mb-3">Arquivados · {archived.length}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((a) => (
              <PhysicalAssetCard key={a.id} asset={a} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatAgeYears(days: number): string {
  if (days < 365) return `${days}d`;
  const years = days / 365;
  return `${years.toFixed(1).replace(".", ",")} anos`;
}

function InsightTile({
  label,
  name,
  pct,
  delta,
  tone,
}: {
  label: string;
  name: string;
  pct: number;
  delta: number;
  tone: "positive" | "negative";
}) {
  return (
    <div className="rounded-[var(--radius)] bg-surface border border-border px-5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div className="text-[14px] font-medium text-foreground mt-1.5 truncate">
        {name}
      </div>
      <div
        className={
          "font-mono text-[18px] tabular-nums mt-1 " +
          (tone === "positive"
            ? "text-olive-700 dark:text-olive-500"
            : "text-rust-600")
        }
      >
        {delta >= 0 ? "+" : ""}
        {formatPercent(pct, 1)}
        <span className="text-[12px] text-muted-foreground ml-2">
          ({delta >= 0 ? "+" : ""}
          {formatBRL(delta)})
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[460px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Inventário vazio
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2">
          O que vocês <em className="italic">possuem</em> no mundo físico?
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          Apartamento, carro, moto, bicicleta, computador, máquina fotográfica. Use a categoria
          mais próxima e o valor que considera de mercado hoje. Atualize quando achar relevante —
          não precisa ser exato.
        </p>
      </div>
    </Panel>
  );
}
