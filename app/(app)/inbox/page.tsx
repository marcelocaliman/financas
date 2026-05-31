import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, X, Loader2, AlertTriangle, Inbox as InboxIcon } from "lucide-react";
import {
  listDocumentUploads,
  getMonthlyCount,
  MONTHLY_LIMIT_PER_HOUSEHOLD,
} from "@/services/inbox/document-uploads";
import { isOpenAIConfigured } from "@/lib/openai/client";
import { getCurrentUserContext } from "@/services/auth";
import { DOCUMENT_TYPE_LABELS } from "@/services/inbox/document-types";
import { InboxDropzone } from "@/components/inbox/inbox-dropzone";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const [uploads, monthlyCount] = await Promise.all([
    listDocumentUploads({ limit: 100 }),
    getMonthlyCount(ctx.household.id),
  ]);

  const openaiOk = isOpenAIConfigured();
  const remaining = MONTHLY_LIMIT_PER_HOUSEHOLD - monthlyCount;

  // Agrupa por status
  const grouped = {
    review: uploads.filter((u) => u.status === "review"),
    pending: uploads.filter((u) => u.status === "pending" || u.status === "extracting"),
    error: uploads.filter((u) => u.status === "error"),
    confirmed: uploads.filter((u) => u.status === "confirmed"),
    discarded: uploads.filter((u) => u.status === "discarded"),
  };

  return (
    <>
      <PageHeader
        eyebrow={`${monthlyCount}/${MONTHLY_LIMIT_PER_HOUSEHOLD} documentos este mês`}
        title={
          <>
            Seus <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">documentos</em>
          </>
        }
        subtitle="Joga aqui qualquer documento (PDF, foto, CSV). A IA classifica, extrai os dados, e você confirma — vai automático pras tabelas certas."
      />

      {/* Aviso se OPENAI_API_KEY não configurado */}
      {!openaiOk ? (
        <Panel className="mb-5 border-gold-600/30 bg-gold-50 dark:bg-gold-900/15">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-gold-700 dark:text-gold-500 mt-0.5 shrink-0" strokeWidth={1.7} />
            <div>
              <div className="font-display text-[15px] text-foreground">OpenAI ainda não configurado</div>
              <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                Pra ativar a leitura automática dos documentos, adicione{" "}
                <code className="font-mono text-[11.5px] bg-surface-muted px-1.5 py-0.5 rounded">OPENAI_API_KEY=sk-...</code>{" "}
                no <code className="font-mono text-[11.5px] bg-surface-muted px-1.5 py-0.5 rounded">.env.local</code>{" "}
                (ou no Vercel) e reinicie o servidor. Toda a infra já está pronta — só falta a chave.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Upload area */}
      <Panel className="mb-6">
        <InboxDropzone disabled={!openaiOk || remaining <= 0} remainingThisMonth={remaining} />
      </Panel>

      {/* Em review (precisa de ação) */}
      {grouped.review.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display text-[18px] tracking-[-0.01em] text-foreground mb-3">
            Aguardando sua confirmação{" "}
            <span className="font-mono text-[11.5px] text-faint-foreground tracking-[0.06em] ml-1">
              {grouped.review.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {grouped.review.map((u) => (
              <DocumentCard key={u.id} doc={u} highlight />
            ))}
          </div>
        </section>
      ) : null}

      {/* Em processamento */}
      {grouped.pending.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display text-[18px] tracking-[-0.01em] text-foreground mb-3">
            Processando{" "}
            <span className="font-mono text-[11.5px] text-faint-foreground tracking-[0.06em] ml-1">
              {grouped.pending.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {grouped.pending.map((u) => (
              <DocumentCard key={u.id} doc={u} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Erros */}
      {grouped.error.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display text-[18px] tracking-[-0.01em] text-foreground mb-3">
            Com erro{" "}
            <span className="font-mono text-[11.5px] text-faint-foreground tracking-[0.06em] ml-1">
              {grouped.error.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {grouped.error.map((u) => (
              <DocumentCard key={u.id} doc={u} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Confirmados (histórico) */}
      {grouped.confirmed.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display text-[18px] tracking-[-0.01em] text-foreground mb-3 opacity-70">
            Histórico (aplicados){" "}
            <span className="font-mono text-[11.5px] text-faint-foreground tracking-[0.06em] ml-1">
              {grouped.confirmed.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {grouped.confirmed.map((u) => (
              <DocumentCard key={u.id} doc={u} muted />
            ))}
          </div>
        </section>
      ) : null}

      {uploads.length === 0 ? (
        <Panel className="!py-16 text-center">
          <InboxIcon className="w-10 h-10 text-faint-foreground mx-auto mb-3 opacity-50" strokeWidth={1.5} />
          <p className="text-[14px] text-muted-foreground">
            Inbox vazio. Solte um documento acima pra começar.
          </p>
        </Panel>
      ) : null}
    </>
  );
}

type DocumentRow = Awaited<ReturnType<typeof listDocumentUploads>>[number];

function DocumentCard({
  doc,
  highlight,
  muted,
}: {
  doc: DocumentRow;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={`/inbox/${doc.id}`}
      className={`block rounded-[10px] border px-4 py-3.5 transition-colors group ${
        highlight
          ? "border-navy-600/40 bg-navy-50 dark:bg-navy-900/15 hover:bg-navy-100/60 dark:hover:bg-navy-900/25"
          : muted
            ? "border-border bg-surface opacity-60 hover:opacity-100"
            : "border-border bg-surface hover:bg-surface-muted/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={doc.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {doc.detected_type ? (
              <Badge tone="navy">{DOCUMENT_TYPE_LABELS[doc.detected_type]}</Badge>
            ) : null}
            <span className="text-[11.5px] font-mono text-faint-foreground">
              {new Date(doc.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="text-[13px] text-foreground font-medium truncate">
            {doc.original_filename}
          </div>
          {doc.error_message ? (
            <div className="text-[11.5px] text-rust-600 mt-1 truncate">{doc.error_message}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function StatusIcon({ status }: { status: DocumentRow["status"] }) {
  if (status === "review")
    return <FileText className="w-4 h-4 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />;
  if (status === "extracting" || status === "pending")
    return (
      <Loader2
        className="w-4 h-4 text-gold-600 animate-spin shrink-0 mt-0.5"
        strokeWidth={1.7}
      />
    );
  if (status === "error")
    return <AlertTriangle className="w-4 h-4 text-rust-600 shrink-0 mt-0.5" strokeWidth={1.7} />;
  if (status === "confirmed")
    return <Check className="w-4 h-4 text-olive-700 dark:text-olive-500 shrink-0 mt-0.5" strokeWidth={2} />;
  return <X className="w-4 h-4 text-faint-foreground shrink-0 mt-0.5" strokeWidth={1.7} />;
}
