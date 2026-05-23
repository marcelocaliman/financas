import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { PortfolioLiveTicker } from "@/components/investments/portfolio-live-ticker";
import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { FixedIncomeTable } from "@/components/investments/fixed-income-table";
import { VariableIncomeTable } from "@/components/investments/variable-income-table";
import { KeyboardNav } from "@/components/ui/keyboard-nav";
import { ScrollTarget } from "@/components/ui/scroll-target";
import {
  AllocationDonut,
  type DonutSegment,
} from "@/components/ui/allocation-donut";
import { listAccounts } from "@/services/accounts";
import { listInvestments, getLatestIndexer } from "@/services/investments";
import { getLivePortfolio } from "@/services/live-yield";

export const dynamic = "force-dynamic";

export default async function InvestimentosPage() {
  const [investments, accounts, live, selic, cdi] = await Promise.all([
    listInvestments(),
    listAccounts(),
    getLivePortfolio(),
    getLatestIndexer("selic"),
    getLatestIndexer("cdi"),
  ]);

  const investmentAccounts = accounts
    .filter((a) => a.type === "investment")
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));
  const destinationAccounts = accounts
    .filter((a) => ["checking", "savings", "cash"].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));

  const liveByAssetId = new Map(live.byAsset.map((a) => [a.id, a]));

  const fixedIncome = investments.filter(
    (i) => i.asset_type === "fixed_income_public" || i.asset_type === "fixed_income_private",
  );
  const variableIncome = investments.filter(
    (i) =>
      i.asset_type === "fii" ||
      i.asset_type === "stock" ||
      i.asset_type === "etf" ||
      i.asset_type === "crypto",
  );

  // Alocação por classe (donut)
  const allocationSegments: DonutSegment[] = [
    {
      key: "fixedIncome",
      label: "Renda fixa",
      value: live.byClass.fixedIncome.balance,
      color: "var(--color-olive-600)",
    },
    {
      key: "fiis",
      label: "FIIs",
      value: live.byClass.fiis.balance,
      color: "var(--color-navy-700)",
    },
    {
      key: "stocks",
      label: "Ações / ETFs",
      value: live.byClass.stocks.balance,
      color: "var(--color-gold-600)",
    },
    {
      key: "other",
      label: "Cripto / outros",
      value: live.byClass.other.balance,
      color: "var(--color-rust-600)",
    },
  ];
  const portfolioTotal =
    live.byClass.fixedIncome.balance +
    live.byClass.fiis.balance +
    live.byClass.stocks.balance +
    live.byClass.other.balance;

  return (
    <>
      <PageHeader
        eyebrow={`Patrimônio · ${investments.length} ativo${investments.length !== 1 ? "s" : ""}`}
        title={
          <>
            A carteira <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">respirando.</em>
          </>
        }
        subtitle="Tesouro/CDB rendem com a Selic do BCB; ações/FIIs marcam a valor de mercado pela brapi."
        actions={<NewInvestmentButton investmentAccounts={investmentAccounts} />}
      />

      {investments.length === 0 ? (
        <EmptyState hasInvestmentAccounts={investmentAccounts.length > 0} />
      ) : (
        <>
          <PortfolioLiveTicker portfolio={live} variant="full" />

          {/* Alocação + Benchmarks (lado a lado em telas grandes) */}
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mb-8">
            <Panel>
              <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-4">
                Alocação por classe
              </div>
              <AllocationDonut
                segments={allocationSegments}
                centerLabel="Total"
                centerValue={formatBRLCompact(portfolioTotal)}
              />
            </Panel>
            <Panel>
              <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-4">
                Indexadores · referência
              </div>
              <BenchmarkRow
                name="Selic"
                value={selic?.value ?? null}
                date={selic?.date ?? null}
              />
              <BenchmarkRow
                name="CDI"
                value={cdi?.value ?? null}
                date={cdi?.date ?? null}
              />
              <p className="text-[11.5px] text-muted-foreground mt-4 leading-relaxed">
                Taxas anuais. Renda fixa indexada ao CDI/Selic rende{" "}
                <em className="italic">de fato</em> esse % anualizado (com multiplicador
                de cada ativo).
              </p>
            </Panel>
          </div>

          {fixedIncome.length > 0 ? (
            <ScrollTarget targetId="fixed-income">
              <FixedIncomeTable
                investments={fixedIncome}
                liveByAssetId={liveByAssetId}
                investmentAccounts={investmentAccounts}
                destinationAccounts={destinationAccounts}
                portfolioTotal={portfolioTotal}
              />
            </ScrollTarget>
          ) : null}

          {variableIncome.length > 0 ? (
            <ScrollTarget targetId="variable-income">
              <VariableIncomeTable
                investments={variableIncome}
                liveByAssetId={liveByAssetId}
                investmentAccounts={investmentAccounts}
                portfolioTotal={portfolioTotal}
              />
            </ScrollTarget>
          ) : null}

          <p className="text-[10.5px] font-mono text-faint-foreground tracking-[0.06em] mt-4">
            Renda fixa atualiza com a Selic todo dia útil (cron BCB). Cotações da B3 via brapi.dev.
          </p>

          <KeyboardNav
            items={[
              { key: "f", label: "Renda fixa", target: "fixed-income", available: fixedIncome.length > 0 },
              { key: "v", label: "Renda variável", target: "variable-income", available: variableIncome.length > 0 },
            ]}
          />
        </>
      )}
    </>
  );
}

function BenchmarkRow({
  name,
  value,
  date,
}: {
  name: string;
  value: number | null;
  date: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-border last:border-b-0">
      <span className="text-[13.5px] font-medium text-foreground">{name}</span>
      <div className="text-right">
        <div className="font-mono text-[16px] tabular-nums text-foreground">
          {value != null ? `${value.toFixed(2).replace(".", ",")}%` : "—"}
          <span className="text-[11px] text-muted-foreground ml-1">a.a.</span>
        </div>
        {date ? (
          <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
            atualizado · {formatDateShortBR(date)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatBRLCompact(v: number): string {
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 10_000)
    return `R$ ${(v / 1000).toFixed(0)}k`;
  if (v >= 1000)
    return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatDateShortBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
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
