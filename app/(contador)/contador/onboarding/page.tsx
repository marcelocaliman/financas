import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { getCurrentAccountantContext } from "@/services/accountant-auth";
import { getDPATerms } from "@/services/accountant-dpa";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/accountant/onboarding-form";

export const dynamic = "force-dynamic";

export default async function ContadorOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Já tem perfil? vai pro dashboard
  const ctx = await getCurrentAccountantContext();
  if (ctx) redirect("/contador");

  // Verifica conflito com conta titular
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingUser) {
    return (
      <>
        <PageHeader
          eyebrow="Acesso bloqueado"
          title={
            <>
              Conta <em className="not-italic font-display italic text-rust-600">já existe</em>
            </>
          }
          subtitle="Esse email já tem uma conta de usuário titular. Crie outra conta com email diferente pra atuar como contador."
        />
      </>
    );
  }

  const { text } = getDPATerms();

  return (
    <>
      <PageHeader
        eyebrow="Primeiro acesso"
        title={
          <>
            Bem-vindo,{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              contador
            </em>
          </>
        }
        subtitle="Antes de acessar dados de clientes, preencha seu perfil e aceite o termo de tratamento de dados (LGPD)."
      />

      <Panel className="!p-7">
        <OnboardingForm email={user.email ?? ""} dpaText={text} />
      </Panel>
    </>
  );
}
