import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { getFirePreferences } from "@/services/fire";
import { getCurrentUserContext } from "@/services/auth";
import { FirePreferencesForm } from "@/components/fire/fire-preferences-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesFirePage() {
  const [prefs, ctx] = await Promise.all([
    getFirePreferences(),
    getCurrentUserContext(),
  ]);
  if (!prefs || !ctx) return null;

  const isAdmin = ctx.profile.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow="FIRE · parâmetros do plano"
        title={
          <>
            Configurações de <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">independência</em>
          </>
        }
        subtitle="Defina renda alvo, retorno esperado e parâmetros pessoais. Os números compartilhados (renda, retorno, inflação, SWR) só admin do household altera. Os individuais (idade, INSS) cada um edita o seu."
      />

      <Panel>
        <FirePreferencesForm
          defaults={prefs}
          isAdmin={isAdmin}
        />
      </Panel>
    </>
  );
}
