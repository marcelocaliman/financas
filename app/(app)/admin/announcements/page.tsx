import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { listAllAnnouncements } from "@/services/announcements";
import { AnnouncementsList } from "@/components/admin/announcements-list";
import { NewAnnouncementForm } from "@/components/admin/new-announcement-form";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const announcements = await listAllAnnouncements();
  const active = announcements.filter((a) => {
    const now = Date.now();
    if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
    if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
    return true;
  }).length;

  return (
    <>
      <PageHeader
        eyebrow={`${announcements.length} anúncios · ${active} ativos`}
        title={
          <>
            <span className="inline-flex items-center gap-2">
              <Megaphone className="w-7 h-7 text-navy-700 dark:text-navy-300" strokeWidth={1.5} />
              <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">Anúncios</em>
            </span>
          </>
        }
        subtitle="Banners globais exibidos pros usuários no app. Use pra avisar manutenção, novidade ou alerta. Suporta agendamento (start/end), target por tier e botão dispensar."
      />

      <Panel className="mb-6">
        <NewAnnouncementForm />
      </Panel>

      <AnnouncementsList announcements={announcements} />
    </>
  );
}
