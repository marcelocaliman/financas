import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { PortfolioLiveTicker } from "@/components/investments/portfolio-live-ticker";
import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { FixedIncomeTable } from "@/components/investments/fixed-income-table";
import { VariableIncomeTable } from "@/components/investments/variable-income-table";
import { KeyboardNav } from "@/components/ui/keyboard-nav";
import { ScrollTarget } from "@/components/ui/scroll-target";
import { listAccounts } from "@/services/accounts";
import { listInvestments } from "@/services/investments";
import { getLivePortfolio } from "@/services/live-yield";

export const dynamic = "force-dynamic";

export default async function InvestimentosPage() {
  const [investments, accounts, live] = await Promise.all([
    listInvestments(),
    listAccounts(),
    getLivePortfolio(),
  ]);

  const investmentAccounts = accounts
    .filter((a) => a.type === "investment")
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));
  const destinationAccounts = accounts
    .filter((a) => ["checking", "savings", "cash"].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));

  const liveByAssetId = new Map(live.byAsset.map((a) => [a.id, a]));

  // Renda fixa: Tesouro, CDB, LCI, LCA, debêntures, etc.
  const fixedIncome = investments.filter(
    (i) => i.asset_type === "fixed_income_public" || i.asset_type === "fixed_income_private",
  );
  // Renda variável: FII, ação, ETF, cripto
  const variableIncome = investments.filter(
    (i) =>
      i.asset_type === "fii" ||
      i.asset_type === "stock" ||
      i.asset_type === "etf" ||
      i.asset_type === "crypto",
  );

  return (
    <>
      <PageHeader
        eyebrow={`Patrimônio · ${investments.length} ativo${investments.length !== 1 ? "s" : ""}`}
        title={
          <>
            A carteira <em className="not-italic font-display italic text-navy-700">respirando.</em>
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

          {fixedIncome.length > 0 ? (
            <ScrollTarget targetId="fixed-income">
              <FixedIncomeTable
                investments={fixedIncome}
                liveByAssetId={liveByAssetId}
                investmentAccounts={investmentAccounts}
                destinationAccounts={destinationAccounts}
              />
            </ScrollTarget>
          ) : null}

          {variableIncome.length > 0 ? (
            <ScrollTarget targetId="variable-income">
              <VariableIncomeTable
                investments={variableIncome}
                liveByAssetId={liveByAssetId}
                investmentAccounts={investmentAccounts}
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
