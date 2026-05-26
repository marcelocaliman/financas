import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getBudgetVsActual } from "@/services/budgets";
import { listCategories } from "@/services/categories";
import { BudgetManager } from "@/components/budgets/budget-manager";

export const dynamic = "force-dynamic";

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const [rows, allCategories] = await Promise.all([
    getBudgetVsActual(month),
    listCategories({ includeArchived: false }),
  ]);

  const expenseCategories = allCategories.filter((c) => c.kind === "expense");
  const totalBudgeted = rows.reduce((s, r) => s + r.budgetAmount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.actualSpent, 0);
  const overCount = rows.filter((r) => r.status === "over").length;
  const warningCount = rows.filter((r) => r.status === "warning").length;

  // Empty state: usuário sem nenhuma categoria de despesa
  if (expenseCategories.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Orçamento por categoria"
          title={
            <>
              Defina <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">tetos</em> de gasto
            </>
          }
          subtitle="Pra orçar, primeiro você precisa de categorias de despesa cadastradas. Cadastre suas categorias e volte aqui."
        />
        <EmptyState
          eyebrow="Sem categorias ainda"
          title={
            <>
              Cadastre suas <em className="italic">categorias</em> primeiro
            </>
          }
          description="Mercado, transporte, restaurantes, saúde... O orçamento funciona definindo tetos pra cada categoria. Vai em /categorias e adicione as principais — depois volte aqui pra definir os limites."
          cta={{ href: "/categorias", label: "Ir pra categorias" }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Orçamento por categoria"
        title={
          <>
            Quanto vc{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              quer
            </em>{" "}
            gastar
          </>
        }
        subtitle="Define um teto pra cada categoria. O app compara com o gasto real do mês e te avisa quando passa do limite. Categorias sem orçamento não geram alerta."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        <KpiCard label="Total orçado" value={totalBudgeted} tone="neutral" />
        <KpiCard
          label="Total gasto"
          value={totalSpent}
          tone={totalSpent > totalBudgeted ? "negative" : "neutral"}
        />
        <KpiCard
          label="Sobra/Excesso"
          value={totalBudgeted - totalSpent}
          tone={totalBudgeted >= totalSpent ? "positive" : "negative"}
        />
        <KpiCard
          label="Categorias estouradas"
          textValue={`${overCount}/${rows.length}`}
          tone={overCount > 0 ? "negative" : warningCount > 0 ? "muted" : "positive"}
          hint={warningCount > 0 ? `${warningCount} no limite` : undefined}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Categorias de despesa"
          meta="Clique no valor pra editar o orçamento"
        />
        <BudgetManager
          rows={rows}
          allCategories={expenseCategories.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
          }))}
        />
      </Panel>

      <Panel className="mt-5 border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Como interpretar
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground leading-relaxed">
          <li>
            <b className="text-foreground">Verde</b>: gastou ≤ 80% do orçamento.
          </li>
          <li>
            <b className="text-foreground">Amarelo</b>: gastou entre 80% e 100% — atenção.
          </li>
          <li>
            <b className="text-foreground">Vermelho</b>: estourou o orçamento.
          </li>
          <li>
            <b className="text-foreground">Cinza</b>: categoria sem orçamento definido — não conta como alerta.
          </li>
        </ul>
      </Panel>
    </>
  );
}
