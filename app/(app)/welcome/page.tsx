import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { QuickStart } from "@/components/onboarding/quick-start";
import { getCurrentUserContext } from "@/services/auth";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Onboarding. Por padrão mostra o QuickStart "valor primeiro" (cadastra contas
 * → cai no painel e vê o IR se montar). O setup fiscal completo (CPF,
 * dependentes, fontes, renda/despesas fixas) é opcional e fica em ?full=1.
 *
 * Pula automaticamente pra /dashboard se o user já completou e não veio com
 * ?force=1.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string; full?: string }>;
}) {
  const { force, full } = await searchParams;
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

  // Auto-skip: usuário já completou (ou pulou). ?force=1 ignora.
  if (hh?.onboarding_completed_at && force !== "1") {
    redirect("/dashboard");
  }

  const fullSetup = full === "1";

  if (fullSetup) {
    return (
      <>
        <PageHeader
          eyebrow={`Bem-vindo${ctx.profile.display_name ? `, ${ctx.profile.display_name.split(" ")[0]}` : ""}`}
          title={
            <>
              Setup{" "}
              <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">completo.</em>
            </>
          }
          subtitle="Seus dados, família, contas, fontes pagadoras, renda e despesas fixas — preenchendo tudo aqui, sua declaração de IR fica 90% automática."
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

  return (
    <>
      <PageHeader
        eyebrow={`Bem-vindo${ctx.profile.display_name ? `, ${ctx.profile.display_name.split(" ")[0]}` : ""}`}
        title={
          <>
            Vamos começar pelo{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">essencial.</em>
          </>
        }
        subtitle="Cadastre suas contas e comece a lançar — o painel monta seu fluxo, seu patrimônio e a estimativa do IR sozinho. Leva uns 2 minutos."
      />

      <Panel className="!p-8">
        <QuickStart existingAccounts={accounts} />
      </Panel>

      <p className="text-center text-[12.5px] text-muted-foreground mt-4">
        Prefere preencher tudo de uma vez (incluindo dados de IR)?{" "}
        <Link
          href="/welcome?full=1"
          className="text-navy-700 dark:text-navy-300 hover:underline font-medium"
        >
          Setup completo →
        </Link>
      </p>
    </>
  );
}
