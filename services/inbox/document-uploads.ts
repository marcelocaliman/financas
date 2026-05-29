import "server-only";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentType, ExtractedData } from "./document-types";

/**
 * CRUD da tabela document_uploads + helpers de storage.
 *
 * O bucket é `inbox-documents`. Path convention:
 *   <household_id>/<year>/<month>/<uuid>-<filename>
 *
 * Schema/RLS na migration 20260528130000_document_inbox.sql.
 */

export type DocumentUploadStatus =
  | "pending"
  | "extracting"
  | "review"
  | "confirmed"
  | "discarded"
  | "error";

export type DocumentUploadRow = {
  id: string;
  household_id: string;
  uploaded_by: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  file_hash: string | null;
  detected_type: DocumentType | null;
  status: DocumentUploadStatus;
  extracted_data: ExtractedData["data"] | null;
  reviewed_data: ExtractedData["data"] | null;
  openai_model: string | null;
  openai_input_tokens: number | null;
  openai_output_tokens: number | null;
  openai_cost_cents: number | null;
  openai_request_id: string | null;
  applied_record_ids: Record<string, string[]> | null;
  error_message: string | null;
  confirmed_at: string | null;
  discarded_at: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// LIMITES (hard caps)
// ============================================================================

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MONTHLY_LIMIT_PER_HOUSEHOLD = 100;

export function computeFileHash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

// ============================================================================
// READS
// ============================================================================

export async function listDocumentUploads(opts?: {
  status?: DocumentUploadStatus;
  limit?: number;
}): Promise<DocumentUploadRow[]> {
  const supabase = await createClient();
  type Builder = {
    select: (s: string) => Builder;
    eq: (c: string, v: unknown) => Builder;
    order: (c: string, o: object) => Builder;
    limit: (n: number) => Promise<{ data: DocumentUploadRow[] | null }>;
  };
  let q = (supabase.from as unknown as (t: string) => Builder)(
    "document_uploads",
  ).select("*");
  if (opts?.status) q = q.eq("status", opts.status);
  const { data } = await q
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  // Watchdog: marca como erro qualquer doc preso em 'extracting' por >5 min.
  // Best-effort, dispara fire-and-forget pra não atrasar o render.
  await unstickStuckExtractions(data ?? []);
  return data ?? [];
}

/**
 * Marca como 'error' qualquer doc em 'extracting' há mais de 5 minutos.
 * Pega casos de crash mid-extract ou execution timeout.
 */
async function unstickStuckExtractions(rows: DocumentUploadRow[]): Promise<void> {
  const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
  const now = Date.now();
  const stuck = rows.filter(
    (r) =>
      r.status === "extracting" &&
      now - new Date(r.updated_at).getTime() > STUCK_THRESHOLD_MS,
  );
  if (stuck.length === 0) return;
  const admin = createAdminClient();
  for (const r of stuck) {
    await (admin.from as unknown as (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<{ error: unknown }>;
      };
    })("document_uploads")
      .update({
        status: "error",
        error_message:
          "Extração ficou presa por mais de 5 minutos. Tente re-extrair ou descartar.",
      })
      .eq("id", r.id);
    // Mutate em memória pra UI já refletir
    r.status = "error";
    r.error_message =
      "Extração ficou presa por mais de 5 minutos. Tente re-extrair ou descartar.";
  }
}

export async function getDocumentUpload(id: string): Promise<DocumentUploadRow | null> {
  const supabase = await createClient();
  type Builder = {
    select: (s: string) => Builder;
    eq: (c: string, v: unknown) => Builder;
    maybeSingle: () => Promise<{ data: DocumentUploadRow | null }>;
  };
  const { data } = await (supabase.from as unknown as (t: string) => Builder)(
    "document_uploads",
  )
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getMonthlyCount(householdId: string): Promise<number> {
  const admin = createAdminClient();
  type Builder = {
    select: (s: string) => Builder;
    eq: (c: string, v: unknown) => Promise<{ data: Array<{ count_this_month: number }> | null }>;
  };
  const { data } = await (admin.from as unknown as (t: string) => Builder)(
    "document_uploads_current_month_count",
  )
    .select("count_this_month")
    .eq("household_id", householdId);
  return data?.[0]?.count_this_month ?? 0;
}

// ============================================================================
// CREATE — Salva o arquivo no storage e cria a row
// ============================================================================

export async function createDocumentUpload(args: {
  householdId: string;
  uploadedBy: string;
  fileContent: Buffer;
  originalFilename: string;
  mimeType: string;
}): Promise<{ id: string; storagePath: string } | { error: string }> {
  if (args.fileContent.length > MAX_FILE_SIZE_BYTES) {
    return { error: `Arquivo maior que ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` };
  }

  // Enforce monthly cap
  const currentCount = await getMonthlyCount(args.householdId);
  if (currentCount >= MONTHLY_LIMIT_PER_HOUSEHOLD) {
    return {
      error: `Limite mensal atingido (${MONTHLY_LIMIT_PER_HOUSEHOLD} documentos por mês). Tente novamente no próximo mês.`,
    };
  }

  const hash = computeFileHash(args.fileContent);

  // Check dup — pula docs discarded (user pode re-upar arquivo descartado)
  const admin = createAdminClient();
  type DupQuery = {
    select: (s: string) => {
      eq: (
        c: string,
        v: unknown,
      ) => {
        eq: (
          c: string,
          v: unknown,
        ) => {
          neq: (
            c: string,
            v: unknown,
          ) => Promise<{
            data: Array<{
              id: string;
              status: string;
              created_at: string;
              detected_type: string | null;
            }> | null;
          }>;
        };
      };
    };
  };
  const { data: existing } = await (
    admin.from as unknown as (t: string) => DupQuery
  )("document_uploads")
    .select("id, status, created_at, detected_type")
    .eq("household_id", args.householdId)
    .eq("file_hash", hash)
    .neq("status", "discarded");
  if (existing && existing.length > 0) {
    const prev = existing[0];
    const when = new Date(prev.created_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const statusLabel =
      prev.status === "confirmed"
        ? "já foi aplicado"
        : prev.status === "review"
          ? "está aguardando confirmação"
          : prev.status === "error"
            ? "está com erro"
            : "está em processamento";
    return {
      error: `Esse arquivo já foi enviado em ${when} e ${statusLabel}. Acesse /inbox pra ver.`,
    };
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const safeName = args.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${args.householdId}/${year}/${month}/${uuid}-${safeName}`;

  // Upload via admin client (service_role)
  const { error: storageError } = await admin.storage
    .from("inbox-documents")
    .upload(storagePath, args.fileContent, {
      contentType: args.mimeType,
      upsert: false,
    });
  if (storageError) {
    return { error: `Falha ao salvar no storage: ${storageError.message}` };
  }

  // Insert row
  type InsertBuilder = {
    insert: (row: Record<string, unknown>) => {
      select: (s: string) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data: inserted, error: insertError } = await (
    admin.from as unknown as (t: string) => InsertBuilder
  )("document_uploads")
    .insert({
      household_id: args.householdId,
      uploaded_by: args.uploadedBy,
      storage_path: storagePath,
      original_filename: args.originalFilename,
      mime_type: args.mimeType,
      size_bytes: args.fileContent.length,
      file_hash: hash,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    // Best-effort rollback
    await admin.storage.from("inbox-documents").remove([storagePath]);
    return { error: insertError?.message ?? "Falha ao criar row." };
  }
  return { id: inserted.id, storagePath };
}

// ============================================================================
// UPDATE — patches específicos pro pipeline
// ============================================================================

export async function markExtracting(id: string): Promise<void> {
  const admin = createAdminClient();
  await (admin.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: unknown }>;
    };
  })("document_uploads")
    .update({ status: "extracting" })
    .eq("id", id);
}

export async function markExtracted(
  id: string,
  args: {
    detectedType: DocumentType;
    extractedData: ExtractedData["data"];
    usage: {
      inputTokens: number;
      outputTokens: number;
      costCents: number;
      model: string;
      requestId: string | null;
    };
  },
): Promise<void> {
  const admin = createAdminClient();
  await (admin.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: unknown }>;
    };
  })("document_uploads")
    .update({
      status: "review",
      detected_type: args.detectedType,
      extracted_data: args.extractedData as unknown as Record<string, unknown>,
      openai_input_tokens: args.usage.inputTokens,
      openai_output_tokens: args.usage.outputTokens,
      openai_cost_cents: args.usage.costCents,
      openai_model: args.usage.model,
      openai_request_id: args.usage.requestId,
    })
    .eq("id", id);
}

export async function markExtractionError(id: string, errorMessage: string): Promise<void> {
  const admin = createAdminClient();
  await (admin.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: unknown }>;
    };
  })("document_uploads")
    .update({ status: "error", error_message: errorMessage })
    .eq("id", id);
}

export async function saveReviewedData(
  id: string,
  reviewedData: ExtractedData["data"],
): Promise<void> {
  const supabase = await createClient();
  await (supabase.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: unknown }>;
    };
  })("document_uploads")
    .update({ reviewed_data: reviewedData as unknown as Record<string, unknown> })
    .eq("id", id);
}

export async function markConfirmed(
  id: string,
  appliedRecordIds: Record<string, string[]>,
): Promise<void> {
  const supabase = await createClient();
  await (supabase.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: unknown }>;
    };
  })("document_uploads")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      applied_record_ids: appliedRecordIds as Record<string, unknown>,
      error_message: null, // limpa erro pendurado de tentativas anteriores
    })
    .eq("id", id);
}

export async function markDiscarded(id: string): Promise<void> {
  const supabase = await createClient();
  await (supabase.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: unknown }>;
    };
  })("document_uploads")
    .update({ status: "discarded", discarded_at: new Date().toISOString() })
    .eq("id", id);
}

// ============================================================================
// READ FILE FROM STORAGE
// ============================================================================

export async function downloadDocumentContent(
  storagePath: string,
): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("inbox-documents")
    .download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("inbox-documents")
    .createSignedUrl(storagePath, expiresInSeconds);
  return data?.signedUrl ?? null;
}
