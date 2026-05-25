"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (alinhado com bucket)

export type ReceiptUploadResult = {
  ok?: boolean;
  error?: string;
  path?: string;
};

/**
 * Sobe um arquivo (PDF/imagem) pro Supabase Storage e linka em
 * ir_deductible_payments.receipt_storage_path.
 *
 * O FormData precisa conter:
 *   - file (File)
 *   - deductibleId (uuid)
 *   - year (number) — usado no path
 */
export async function uploadReceipt(formData: FormData): Promise<ReceiptUploadResult> {
  const file = formData.get("file") as File | null;
  const deductibleId = String(formData.get("deductibleId") ?? "");
  const year = parseInt(String(formData.get("year") ?? ""), 10);

  if (!file) return { error: "Arquivo não informado." };
  if (!deductibleId) return { error: "Pagamento não identificado." };
  if (Number.isNaN(year)) return { error: "Ano inválido." };
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: `Tipo não suportado (${file.type}). Use PDF ou imagem.` };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Arquivo > 10 MB." };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // Confirma que o deductible pertence ao household (defesa em profundidade)
  const { data: payment } = await supabase
    .from("ir_deductible_payments")
    .select("id, receipt_storage_path")
    .eq("id", deductibleId)
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  if (!payment) return { error: "Pagamento não encontrado." };

  // Path convention: household_id/year/deductible_id/<timestamp>-<sanitized>
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const path = `${ctx.household.id}/${year}/${deductibleId}/${Date.now()}-${safeName}`;

  // Remove anexo anterior (se houver)
  if (payment.receipt_storage_path) {
    await supabase.storage.from("ir-receipts").remove([payment.receipt_storage_path]);
  }

  const { error: uploadErr } = await supabase.storage
    .from("ir-receipts")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadErr) return { error: uploadErr.message };

  // Atualiza o registro
  const { error: updateErr } = await supabase
    .from("ir_deductible_payments")
    .update({
      receipt_storage_path: path,
      receipt_mime_type: file.type,
      receipt_size_bytes: file.size,
      receipt_uploaded_at: new Date().toISOString(),
    })
    .eq("id", deductibleId);
  if (updateErr) return { error: updateErr.message };

  revalidatePath("/ir", "layout");
  return { ok: true, path };
}

export async function deleteReceipt(deductibleId: string): Promise<ReceiptUploadResult> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("ir_deductible_payments")
    .select("receipt_storage_path")
    .eq("id", deductibleId)
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  if (!payment?.receipt_storage_path) return { ok: true };

  await supabase.storage.from("ir-receipts").remove([payment.receipt_storage_path]);
  await supabase
    .from("ir_deductible_payments")
    .update({
      receipt_storage_path: null,
      receipt_mime_type: null,
      receipt_size_bytes: null,
      receipt_uploaded_at: null,
    })
    .eq("id", deductibleId);

  revalidatePath("/ir", "layout");
  return { ok: true };
}

/**
 * Gera URL assinada pra download (privacy: bucket é privado, então URL pública
 * não funciona). Validade curta (5 min) é suficiente pra clique.
 */
export async function getReceiptSignedUrl(deductibleId: string): Promise<{ url?: string; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("ir_deductible_payments")
    .select("receipt_storage_path")
    .eq("id", deductibleId)
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  if (!payment?.receipt_storage_path) return { error: "Sem recibo." };

  const { data, error } = await supabase.storage
    .from("ir-receipts")
    .createSignedUrl(payment.receipt_storage_path, 300); // 5 min
  if (error) return { error: error.message };
  return { url: data?.signedUrl };
}
