import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { listPendingDataRequests } from "@/services/platform-admin";
import { DataRequestActions } from "@/components/admin/data-request-actions";

export const dynamic = "force-dynamic";

export default async function AdminDataRequestsPage() {
  const requests = await listPendingDataRequests();

  return (
    <>
      <PageHeader
        eyebrow={`${requests.length} pendente${requests.length === 1 ? "" : "s"} · LGPD`}
        title={
          <>
            Solicitações <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">LGPD</em>
          </>
        }
        subtitle="Pedidos do titular de dados (Lei 13.709/18 art. 18): exportar, apagar ou retificar. Prazo legal: atender em até 15 dias."
      />

      {requests.length === 0 ? (
        <Panel className="!py-14 grid place-items-center text-center">
          <div className="max-w-[460px]">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
              Tudo em dia
            </div>
            <h2 className="font-display text-[24px] tracking-[-0.02em] mt-2 text-foreground">
              Nenhuma solicitação pendente.
            </h2>
            <p className="text-[13.5px] text-muted-foreground mt-2.5 leading-relaxed">
              Quando algum usuário pedir exportar/apagar os dados via{" "}
              <code>/configuracoes/privacidade</code>, vai aparecer aqui.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Panel key={r.id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      tone={
                        r.request_type === "delete"
                          ? "rust"
                          : r.request_type === "rectify"
                            ? "gold"
                            : "navy"
                      }
                    >
                      {r.request_type === "export"
                        ? "Exportar dados"
                        : r.request_type === "delete"
                          ? "Apagar conta"
                          : "Retificar dados"}
                    </Badge>
                    <Badge tone="neutral">{r.status}</Badge>
                  </div>
                  <div className="font-mono text-[12.5px] text-foreground">
                    {r.user_email ?? "—"}
                  </div>
                  <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
                    Solicitado em{" "}
                    {new Date(r.requested_at).toLocaleString("pt-BR")} ·
                    user_id {r.user_id.slice(0, 8)}…
                  </div>
                </div>
                <DueWarning requestedAt={r.requested_at} />
              </div>

              <DataRequestActions
                requestId={r.id}
                requestType={r.request_type}
                userId={r.user_id}
                userEmail={r.user_email}
              />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

function DueWarning({ requestedAt }: { requestedAt: string }) {
  const daysOld = Math.floor(
    (Date.now() - new Date(requestedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysLeft = 15 - daysOld;
  const tone = daysLeft <= 3 ? "rust" : daysLeft <= 7 ? "gold" : "olive";
  return (
    <div className="text-right shrink-0">
      <Badge tone={tone}>
        {daysLeft > 0 ? `${daysLeft} dias pro prazo` : `${Math.abs(daysLeft)} dias VENCIDO`}
      </Badge>
    </div>
  );
}
