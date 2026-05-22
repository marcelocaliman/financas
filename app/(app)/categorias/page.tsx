import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { listCategories, getCategoryStats } from "@/services/categories";
import { CategoryRow } from "@/components/categories/category-row";
import { NewCategoryButton } from "./new-category-button";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const [all, stats] = await Promise.all([
    listCategories({ includeArchived: true }),
    getCategoryStats(3),
  ]);
  const income = all.filter((c) => c.kind === "income" && !c.is_archived);
  const expense = all.filter((c) => c.kind === "expense" && !c.is_archived);
  const archived = all.filter((c) => c.is_archived);

  // Ordena por gasto dos últimos 3m (decrescente). Categorias sem uso vão pro fim.
  const byUsage = (a: { id: string }, b: { id: string }) => {
    const sa = stats.get(a.id)?.total ?? 0;
    const sb = stats.get(b.id)?.total ?? 0;
    return sb - sa;
  };
  income.sort(byUsage);
  expense.sort(byUsage);

  const unusedExpense = expense.filter((c) => !stats.get(c.id));
  const unusedIncome = income.filter((c) => !stats.get(c.id));
  const totalUnused = unusedExpense.length + unusedIncome.length;

  return (
    <>
      <PageHeader
        eyebrow="Vocabulário do dinheiro"
        title={
          <>
            Suas <em className="not-italic font-display italic text-navy-700">categorias.</em>
          </>
        }
        subtitle="Cada lançamento ganha um nome — mercado, salário, delivery. Aqui você modela o vocabulário do casal."
        actions={<NewCategoryButton />}
      />

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
            meta={`${income.length} categoria${income.length !== 1 ? "s" : ""} · média dos últimos 3 meses`}
          />
          {income.length === 0 ? (
            <Empty />
          ) : (
            income.map((c) => (
              <CategoryRow key={c.id} category={c} stats={stats.get(c.id)} />
            ))
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Despesas"
            meta={`${expense.length} categoria${expense.length !== 1 ? "s" : ""} · média dos últimos 3 meses`}
          />
          {expense.length === 0 ? (
            <Empty />
          ) : (
            expense.map((c) => (
              <CategoryRow key={c.id} category={c} stats={stats.get(c.id)} />
            ))
          )}
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
  );
}

function Empty() {
  return (
    <p className="text-[13px] text-faint-foreground italic py-4">
      Nenhuma categoria ativa. Use o botão acima para adicionar uma.
    </p>
  );
}
