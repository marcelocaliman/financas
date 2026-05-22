import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/services/auth";
import { signOut } from "../_actions/sign-out";
import { HouseholdNameForm, ProfileNameForm } from "./profile-forms";
import { ResetDataSection } from "./reset-data-section";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  return (
    <>
      <PageHeader
        eyebrow="Bastidores"
        title={<>Configurações</>}
        subtitle="Conta, lar, parceiras, preferências."
      />

      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Sua conta" meta={`E-mail: ${ctx.email ?? "—"}`} />
          <ProfileNameForm defaultValue={ctx.profile.display_name} />
          <div className="text-[11.5px] text-faint-foreground font-mono tracking-[0.04em] mt-5 pt-4 border-t border-border">
            ID: {ctx.authId} · Papel: {ctx.profile.role}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Seu lar" meta="Nome usado na sidebar e em compartilhamentos" />
          <HouseholdNameForm defaultValue={ctx.household.name} />
        </Panel>

        <Panel>
          <PanelHeader title="Sair" meta="Encerra a sessão neste dispositivo" />
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Encerrar sessão
            </Button>
          </form>
        </Panel>

        <Panel className="border-rust-600/30">
          <PanelHeader
            title={<span className="text-rust-600">Zona perigosa</span>}
            meta="Apaga todos os dados desse lar (irreversível)"
          />
          <ResetDataSection />
        </Panel>
      </div>
    </>
  );
}
