import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getCurrentUserContext } from "@/services/auth";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Wizard de onboarding. Acessível por novos usuários (após cadastro) ou
 * por usuários existentes que querem refazer (via link em /configuracoes).
 *
 * Pula automaticamente pra /dashboard se o user já tem accounts + recorrências
 * configuradas e não veio com ?force=1.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const { force } = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const [{ data: hh }, accounts, categories] = await Promise.all([
    supabase
      .from("households")
      .select("onboarding_completed_at")
      .eq("id", ctx.household.id)
      .maybeSingle(),
    listAccounts(),
    listCategories({ includeArchived: false }),
  ]);

  // Auto-skip: usuário já completou (ou pulou) o wizard. ?force=1 ignora.
  if (hh?.onboarding_completed_at && force !== "1") {
    redirect("/dashboard");
  }

  return (
    <>
      <PageHeader
        eyebrow={`Bem-vindo${ctx.profile.display_name ? `, ${ctx.profile.display_name.split(" ")[0]}` : ""}`}
        title={
          <>
            Vamos montar sua <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">casa.</em>
          </>
        }
        subtitle="7 passos rápidos pra preparar tudo: seus dados, família, contas, fontes pagadoras, renda, despesas fixas. Com isso, sua declaração de IR vai ficar 90% automática."
      />

      <Panel className="!p-8">
        <OnboardingWizard
          existingAccounts={accounts}
          existingCategories={categories}
          defaultName={ctx.profile.display_name}
        />
      </Panel>
    </>
  );
}
