import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { listCategories } from "@/services/categories";
import { CategoryRow } from "@/components/categories/category-row";
import { NewCategoryButton } from "./new-category-button";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const all = await listCategories({ includeArchived: true });
  const income = all.filter((c) => c.kind === "income" && !c.is_archived);
  const expense = all.filter((c) => c.kind === "expense" && !c.is_archived);
  const archived = all.filter((c) => c.is_archived);

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

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <PanelHeader title="Receitas" meta={`${income.length} categoria${income.length !== 1 ? "s" : ""}`} />
          {income.length === 0 ? (
            <Empty />
          ) : (
            income.map((c) => <CategoryRow key={c.id} category={c} />)
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Despesas" meta={`${expense.length} categoria${expense.length !== 1 ? "s" : ""}`} />
          {expense.length === 0 ? (
            <Empty />
          ) : (
            expense.map((c) => <CategoryRow key={c.id} category={c} />)
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
