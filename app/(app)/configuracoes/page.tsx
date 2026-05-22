import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/services/auth";
import { signOut } from "../_actions/sign-out";

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
          <PanelHeader title="Sua conta" meta={`ID: ${ctx.authId.slice(0, 8)}…`} />
          <dl className="grid sm:grid-cols-2 gap-y-4 gap-x-8 text-[14px]">
            <div>
              <dt className="text-faint-foreground text-[11.5px] uppercase tracking-[0.12em] font-mono font-medium">
                Nome
              </dt>
              <dd className="mt-1.5 text-foreground">{ctx.profile.display_name}</dd>
            </div>
            <div>
              <dt className="text-faint-foreground text-[11.5px] uppercase tracking-[0.12em] font-mono font-medium">
                E-mail
              </dt>
              <dd className="mt-1.5 text-foreground">{ctx.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-faint-foreground text-[11.5px] uppercase tracking-[0.12em] font-mono font-medium">
                Papel
              </dt>
              <dd className="mt-1.5 text-foreground capitalize">{ctx.profile.role}</dd>
            </div>
            <div>
              <dt className="text-faint-foreground text-[11.5px] uppercase tracking-[0.12em] font-mono font-medium">
                Lar
              </dt>
              <dd className="mt-1.5 text-foreground">{ctx.household.name}</dd>
            </div>
          </dl>
        </Panel>

        <Panel>
          <PanelHeader title="Sair" meta="Encerra a sessão neste dispositivo" />
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Encerrar sessão
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
