import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { isIrEnabled } from "@/services/ir-flag";
import { FilersManager } from "@/components/ir/filers-manager";
import { DependentsManager } from "@/components/ir/dependents-manager";
import { listHouseholdMembers } from "@/services/household";

export const dynamic = "force-dynamic";

/**
 * Página dedicada pra gerenciar declarantes (titular + cônjuge) e dependentes.
 * Vive dentro do hub IR (link no header do /ir), fora do contexto de um ano —
 * filers/dependentes são household-level, não mudam por ano.
 */
export default async function DeclarantesPage() {
  if (!(await isIrEnabled())) redirect("/dashboard");
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [{ data: filers }, { data: dependents }, members] = await Promise.all([
    supabase
      .from("ir_filers")
      .select("*")
      .eq("is_active", true)
      .order("is_primary", { ascending: false }),
    supabase
      .from("ir_dependents")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    listHouseholdMembers(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={`Declarantes · ${(filers ?? []).length} pessoa(s) · ${(dependents ?? []).length} dependente(s)`}
        title={
          <>
            Quem{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              declara
            </em>
          </>
        }
        subtitle="Titular, cônjuge e dependentes. CPF é obrigatório (Receita exige desde 2019, mesmo recém-nascidos). Casal: cada dependente pertence a UMA declaração — escolha a que maximiza dedução."
      />

      <Panel className="mb-5">
        <PanelHeader
          title="Declarantes (titular + cônjuge)"
          meta="Pessoas que entregam declaração própria"
        />
        <FilersManager filers={filers ?? []} members={members} />
      </Panel>

      <Panel>
        <PanelHeader
          title="Dependentes"
          meta="Filhos, pais, agregados — gera dedução R$ 2.275,08/ano por dependente"
        />
        <DependentsManager dependents={dependents ?? []} filers={filers ?? []} />
      </Panel>

      <Panel className="mt-5 border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Diferença entre declarante e dependente
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground leading-relaxed">
          <li>
            <b className="text-foreground">Declarante</b>: pessoa com CPF que entrega declaração própria. Pode ser o titular ou cônjuge declarando junto/separado.
          </li>
          <li>
            <b className="text-foreground">Dependente</b>: pessoa cujos rendimentos somam aos do declarante na mesma declaração. Filhos ≤21 (ou ≤24 cursando faculdade), pais com renda ≤R$ 23.499,15/ano, cônjuge sem renda.
          </li>
          <li>
            Cada dependente gera <b className="text-foreground">dedução fixa de R$ 2.275,08/ano</b> + permite deduzir despesas dele (educação até R$ 3.561,50 por dependente, médica sem limite).
          </li>
        </ul>
      </Panel>
    </>
  );
}
