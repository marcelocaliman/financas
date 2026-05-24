import { Server } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { listSystemSettings } from "@/services/system-settings";
import { SystemSettingsToggles } from "@/components/admin/system-settings-toggles";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const settings = await listSystemSettings();

  const maintenanceMode = settings.find((s) => s.key === "maintenance_mode")?.value === true;
  const signupEnabled = settings.find((s) => s.key === "signup_enabled")?.value !== false;

  return (
    <>
      <PageHeader
        eyebrow="Sistema · controle de plataforma"
        title={
          <>
            <span className="inline-flex items-center gap-2">
              <Server className="w-7 h-7 text-navy-700 dark:text-navy-300" strokeWidth={1.5} />
              <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">Sistema</em>
            </span>
          </>
        }
        subtitle="Modo manutenção, cadastros, kill switches e configurações de plataforma. Cuidado: mudanças aqui afetam TODOS os usuários."
      />

      {/* Status crítico */}
      {maintenanceMode ? (
        <Panel className="mb-5 border-rust-600/30">
          <div className="flex items-center gap-3">
            <Badge tone="rust">MODO MANUTENÇÃO ATIVO</Badge>
            <span className="text-[13px] text-rust-600">
              Usuários estão bloqueados de usar o app. Desligue ao terminar.
            </span>
          </div>
        </Panel>
      ) : null}
      {!signupEnabled ? (
        <Panel className="mb-5 border-gold-600/30">
          <div className="flex items-center gap-3">
            <Badge tone="gold">CADASTROS BLOQUEADOS</Badge>
            <span className="text-[13px] text-gold-700 dark:text-gold-500">
              Novos usuários não conseguem criar conta. Vc pode estar em campanha
              fechada ou problema operacional.
            </span>
          </div>
        </Panel>
      ) : null}

      <SystemSettingsToggles settings={settings} />

      <Panel className="mt-5 border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Boas práticas
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground">
          <li>
            <b className="text-foreground">Modo manutenção:</b> antes de aplicar
            migration grande, ligue isso. Avise via Anúncios também.
          </li>
          <li>
            <b className="text-foreground">Bloquear cadastros:</b> útil em campanhas
            fechadas ou problemas de capacidade.
          </li>
          <li>
            <b className="text-foreground">Trial padrão:</b> dias de trial pra novos
            households quando ativar billing.
          </li>
        </ul>
      </Panel>
    </>
  );
}
