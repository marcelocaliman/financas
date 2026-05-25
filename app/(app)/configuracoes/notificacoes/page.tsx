import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getNotificationPreferences } from "@/services/notification-preferences.actions";
import { NotificationPreferencesForm } from "@/components/configuracoes/notification-preferences-form";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const prefs = await getNotificationPreferences();

  return (
    <>
      <PageHeader
        eyebrow="Configurações · notificações"
        title={
          <>
            Quando o app deve te{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              avisar
            </em>
          </>
        }
        subtitle="Emails enviados pelo cron diário às 10h BRT. Use com moderação: muita notificação vira ruído."
      />
      <Panel>
        <PanelHeader title="Tipos de notificação" meta="Marque/desmarque cada lembrete" />
        <NotificationPreferencesForm initial={prefs} />
      </Panel>
    </>
  );
}
