import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { listCategories, getCategoryStats } from "@/services/categories";
import { getActiveBudgetsForMonth, getBudgetVsActual } from "@/services/budgets";
import { listCategoryRules } from "@/services/category-rules";
import { CategoryRow } from "@/components/categories/category-row";
import { ReorderableCategoryList } from "@/components/categories/reorderable-category-list";
import { CategoryRulesManager } from "@/components/categories/category-rules-manager";
import { BudgetManager } from "@/components/budgets/budget-manager";
import { NewCategoryButton } from "./new-category-button";
import {
  CategoryViewPills,
  parseCategoryView,
} from "./category-view-pills";
import type { Currency } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const view = parseCategoryView(rawView);

  const [all, stats, budgets, rules] = await Promise.all([
    listCategories({ includeArchived: true }),
    getCategoryStats(3),
    getActiveBudgetsForMonth(),
    listCategoryRules(),
  ]);
  const budgetMap = new Map<string, { amount: number; currency: Currency }>();
  for (const [catId, b] of budgets) {
    budgetMap.set(catId, { amount: Number(b.amount), currency: b.currency });
  }
  const income = all.filter((c) => c.kind === "income" && !c.is_archived);
  const expense = all.filter((c) => c.kind === "expense" && !c.is_archived);
  const archived = all.filter((c) => c.is_archived);

  // listCategories já vem ordenado por sort_order asc. Mantemos essa ordem
  // (que é a configurada manualmente pelo usuário) — reordenação manual
  // tem precedência sobre ordenação por uso.

  const unusedExpense = expense.filter((c) => !stats.get(c.id));
  const unusedIncome = income.filter((c) => !stats.get(c.id));
  const totalUnused = unusedExpense.length + unusedIncome.length;

  const counts = {
    vocabulario: income.length + expense.length,
    orcamento: budgetMap.size,
  };

  // Orçamento (view=orcamento): teto por categoria vs gasto real do mês. Mesma
  // entidade que o vocabulário (categoria + seu teto) — só uma lente diferente.
  const budgetRows = view === "orcamento" ? await getBudgetVsActual() : [];
  const totalBudgeted = budgetRows.reduce((s, r) => s + r.budgetAmount, 0);
  const totalSpent = budgetRows.reduce((s, r) => s + r.actualSpent, 0);
  const overCount = budgetRows.filter((r) => r.status === "over").length;
  const warningCount = budgetRows.filter((r) => r.status === "warning").length;

  const header =
    view === "orcamento"
      ? {
          eyebrow: "Orçamento por categoria",
          title: (
            <>
              Quanto você{" "}
              <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">quer</em>{" "}
              gastar
            </>
          ),
          subtitle:
            "Define um teto pra cada categoria. O app compara com o gasto real do mês e avisa quando passa do limite. Categorias sem orçamento não geram alerta.",
        }
      : {
          eyebrow: "Vocabulário do dinheiro",
          title: (
            <>
              Suas <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">categorias.</em>
            </>
          ),
          subtitle:
            "Cada lançamento ganha um nome — mercado, salário, delivery. Aqui você modela o vocabulário do casal.",
        };

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        subtitle={header.subtitle}
        actions={<NewCategoryButton />}
      />

      <CategoryViewPills view={view} counts={counts} />

      {view === "orcamento" ? (
        expense.length === 0 ? (
          <Panel>
            <p className="text-[13px] text-muted-foreground leading-relaxed py-2">
              Pra orçar você precisa de categorias de despesa. Cadastre na aba{" "}
              <b className="text-foreground">Vocabulário</b> e volte aqui pra definir os tetos.
            </p>
          </Panel>
        ) : (
          <>
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
                textValue={`${overCount}/${budgetRows.length}`}
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
                rows={budgetRows}
                allCategories={expense.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
              />
            </Panel>

            <Panel className="mt-5 border-navy-700/30">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
                Como interpretar
              </div>
              <ul className="text-[13px] space-y-1.5 text-muted-foreground leading-relaxed">
                <li><b className="text-foreground">Verde</b>: gastou ≤ 80% do orçamento.</li>
                <li><b className="text-foreground">Amarelo</b>: gastou entre 80% e 100% — atenção.</li>
                <li><b className="text-foreground">Vermelho</b>: estourou o orçamento.</li>
                <li><b className="text-foreground">Cinza</b>: categoria sem orçamento — não conta como alerta.</li>
              </ul>
            </Panel>
          </>
        )
      ) : (
        <>
          {totalUnused > 0 ? (
            <div className="rounded-[var(--radius)] bg-gold-50 border border-gold-200 dark:bg-gold-700/10 dark:border-gold-700/30 px-5 py-3 mb-5 text-[12.5px]">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-gold-700 dark:text-gold-500 font-medium mr-2">
                Oportunidade
              </span>
              <span className="text-foreground">
                {totalUnused} categoria{totalUnused === 1 ? "" : "s"} sem uso nos últimos 3 meses —
                considere arquivar pra reduzir o ruído.
              </span>
            </div>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-5">
            <Panel>
              <PanelHeader
                title="Receitas"
                meta={`${income.length} categoria${income.length !== 1 ? "s" : ""} · arraste ↑↓ pra reordenar`}
              />
              {income.length === 0 ? (
                <Empty />
              ) : (
                <ReorderableCategoryList initial={income} statsMap={stats} budgetMap={budgetMap} />
              )}
            </Panel>

            <Panel>
              <PanelHeader
                title="Despesas"
                meta={`${expense.length} categoria${expense.length !== 1 ? "s" : ""} · arraste ↑↓ pra reordenar`}
              />
              {expense.length === 0 ? (
                <Empty />
              ) : (
                <ReorderableCategoryList initial={expense} statsMap={stats} budgetMap={budgetMap} />
              )}
            </Panel>
          </div>

          {/* Regras de auto-categorização */}
          <div className="mt-8">
            <Panel>
              <PanelHeader
                title="Regras de auto-categorização"
                meta={`${rules.length} regra${rules.length !== 1 ? "s" : ""} ativa${rules.length !== 1 ? "s" : ""}`}
              />
              <CategoryRulesManager initialRules={rules} categories={all} />
            </Panel>
          </div>

          {archived.length > 0 ? (
            <div className="mt-8">
              <Panel>
                <PanelHeader title="Arquivadas" meta={`${archived.length}`} />
                {archived.map((c) => (
                  <CategoryRow key={c.id} category={c} />
                ))}
              </Panel>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function Empty() {
  return (
    <p className="text-[13px] text-faint-foreground italic py-4">
      Nenhuma categoria ativa. Use o botão acima para adicionar uma.
    </p>
  );
}
