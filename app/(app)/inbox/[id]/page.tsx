import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, FileText, Loader2, AlertTriangle, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import {
  getDocumentUpload,
  getSignedDocumentUrl,
} from "@/services/inbox/document-uploads";
import { DOCUMENT_TYPE_LABELS } from "@/services/inbox/document-types";
import { listAccounts } from "@/services/accounts";
import { listFilers } from "@/services/ir/filers";
import { getCurrentUserContext } from "@/services/auth";
import { InboxReviewPanel } from "@/components/inbox/inbox-review-panel";
import { CsvPreview } from "@/components/inbox/csv-preview";

export const dynamic = "force-dynamic";

export default async function InboxDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const doc = await getDocumentUpload(id);
  if (!doc) notFound();
  if (doc.household_id !== ctx.household.id) redirect("/inbox");

  const [previewUrl, accounts, filers] = await Promise.all([
    getSignedDocumentUrl(doc.storage_path, 600),
    listAccounts(),
    listFilers(ctx.household.id),
  ]);

  return (
    <>
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar ao Inbox
      </Link>

      <PageHeader
        eyebrow={`#${doc.id.slice(0, 8)} · ${new Date(doc.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
        title={
          <>
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              {doc.detected_type ? DOCUMENT_TYPE_LABELS[doc.detected_type] : "Documento"}
            </em>
          </>
        }
        subtitle={doc.original_filename}
      />

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5 mb-5">
        {/* Preview */}
        <Panel>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
            Preview do arquivo
          </div>
          {previewUrl ? (
            doc.mime_type === "application/pdf" ? (
              <iframe
                src={previewUrl}
                className="w-full h-[600px] rounded-[8px] border border-border"
                title="Preview"
              />
            ) : doc.mime_type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full rounded-[8px] border border-border"
              />
            ) : doc.mime_type === "text/csv" ||
              doc.mime_type === "text/plain" ||
              doc.original_filename.toLowerCase().endsWith(".csv") ? (
              <CsvPreview url={previewUrl} filename={doc.original_filename} />
            ) : (
              <div className="bg-surface-muted rounded-[8px] p-4 max-h-[600px] overflow-auto">
                <p className="text-[12.5px] text-muted-foreground italic">
                  Pré-visualização não disponível pra esse tipo. Baixe via link abaixo.
                </p>
                <a
                  href={previewUrl}
                  download={doc.original_filename}
                  className="inline-block mt-3 text-[12.5px] text-navy-700 dark:text-navy-300 underline"
                >
                  Baixar {doc.original_filename}
                </a>
              </div>
            )
          ) : (
            <div className="bg-surface-muted rounded-[8px] p-4 text-[12.5px] text-muted-foreground italic">
              Não foi possível gerar URL de preview.
            </div>
          )}
        </Panel>

        {/* Status + dados extraídos */}
        <div className="space-y-5">
          {/* Status */}
          <Panel>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
              Status
            </div>
            <StatusRow status={doc.status} />
            {doc.detected_type ? (
              <div className="mt-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                  Tipo detectado:
                </span>{" "}
                <Badge tone="navy">{DOCUMENT_TYPE_LABELS[doc.detected_type]}</Badge>
              </div>
            ) : null}
            {doc.error_message ? (
              <div className="mt-3 p-3 rounded-[8px] bg-rust-50 dark:bg-rust-900/15 border border-rust-600/30">
                <div className="text-[12px] text-rust-700 dark:text-rust-400">
                  {doc.error_message}
                </div>
              </div>
            ) : null}
            {doc.openai_cost_cents != null ? (
              <div className="mt-3 text-[11.5px] font-mono text-faint-foreground">
                Custo IA: R$ {(doc.openai_cost_cents / 100).toFixed(2)} · modelo {doc.openai_model}
              </div>
            ) : null}
          </Panel>

          {/* Review panel — só quando status=review ou error com dados */}
          {(doc.status === "review" || (doc.status === "error" && doc.extracted_data)) &&
          doc.detected_type ? (
            <InboxReviewPanel
              documentId={doc.id}
              detectedType={doc.detected_type}
              extractedData={doc.extracted_data}
              reviewedData={doc.reviewed_data}
              accounts={accounts.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                institution: a.institution,
              }))}
              filers={filers.map((f) => ({ id: f.id, name: f.full_name }))}
            />
          ) : doc.status === "confirmed" ? (
            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-5 h-5 text-olive-700 dark:text-olive-500" strokeWidth={1.8} />
                <span className="font-display text-[16px] text-foreground">Aplicado</span>
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                Em {new Date(doc.confirmed_at!).toLocaleString("pt-BR")}.
              </div>
              {doc.applied_record_ids ? (
                <div className="mt-3 space-y-1">
                  {Object.entries(doc.applied_record_ids).map(([table, ids]) => (
                    <div key={table} className="text-[11.5px] font-mono text-faint-foreground">
                      {table}: {ids.length} registro(s)
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

function StatusRow({ status }: { status: NonNullable<Awaited<ReturnType<typeof getDocumentUpload>>>["status"] }) {
  if (status === "pending" || status === "extracting")
    return (
      <div className="flex items-center gap-2 text-[13px] text-gold-700 dark:text-gold-500">
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
        Processando…
      </div>
    );
  if (status === "review")
    return (
      <div className="flex items-center gap-2 text-[13px] text-navy-700 dark:text-navy-300">
        <FileText className="w-4 h-4" strokeWidth={1.8} />
        Aguardando sua confirmação
      </div>
    );
  if (status === "confirmed")
    return (
      <div className="flex items-center gap-2 text-[13px] text-olive-700 dark:text-olive-500">
        <Check className="w-4 h-4" strokeWidth={2} />
        Confirmado
      </div>
    );
  if (status === "error")
    return (
      <div className="flex items-center gap-2 text-[13px] text-rust-600">
        <AlertTriangle className="w-4 h-4" strokeWidth={1.8} />
        Erro na extração
      </div>
    );
  return (
    <div className="flex items-center gap-2 text-[13px] text-faint-foreground italic">
      Descartado
    </div>
  );
}
