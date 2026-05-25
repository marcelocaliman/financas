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
const MAX_BYTES = 10 * 1024 * 1024;

export type TxReceiptResult = { ok?: boolean; error?: string; path?: string };

/**
 * Sobe comprovante (PDF/imagem) e linka em transactions.receipt_storage_path.
 * Reusa bucket ir-receipts (path: tx/{household_id}/{tx_id}/{file}).
 */
export async function uploadTransactionReceipt(
  formData: FormData,
): Promise<TxReceiptResult> {
  const file = formData.get("file") as File | null;
  const txId = String(formData.get("transactionId") ?? "");

  if (!file) return { error: "Arquivo não informado." };
  if (!txId) return { error: "Transação não identificada." };
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: `Tipo não suportado (${file.type}). Use PDF ou imagem.` };
  }
  if (file.size > MAX_BYTES) return { error: "Arquivo > 10 MB." };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, receipt_storage_path")
    .eq("id", txId)
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  if (!tx) return { error: "Transação não encontrada." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const path = `tx/${ctx.household.id}/${txId}/${Date.now()}-${safeName}`;

  if (tx.receipt_storage_path) {
    await supabase.storage.from("ir-receipts").remove([tx.receipt_storage_path]);
  }

  const { error: upErr } = await supabase.storage
    .from("ir-receipts")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };

  const { error: updErr } = await supabase
    .from("transactions")
    .update({
      receipt_storage_path: path,
      receipt_mime_type: file.type,
      receipt_size_bytes: file.size,
      receipt_uploaded_at: new Date().toISOString(),
    })
    .eq("id", txId);
  if (updErr) return { error: updErr.message };

  revalidatePath("/transacoes");
  return { ok: true, path };
}

export async function deleteTransactionReceipt(txId: string): Promise<TxReceiptResult> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const { data: tx } = await supabase
    .from("transactions")
    .select("receipt_storage_path")
    .eq("id", txId)
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  if (!tx?.receipt_storage_path) return { ok: true };

  await supabase.storage.from("ir-receipts").remove([tx.receipt_storage_path]);
  await supabase
    .from("transactions")
    .update({
      receipt_storage_path: null,
      receipt_mime_type: null,
      receipt_size_bytes: null,
      receipt_uploaded_at: null,
    })
    .eq("id", txId);

  revalidatePath("/transacoes");
  return { ok: true };
}

export async function getTransactionReceiptUrl(
  txId: string,
): Promise<{ url?: string; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const { data: tx } = await supabase
    .from("transactions")
    .select("receipt_storage_path")
    .eq("id", txId)
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  if (!tx?.receipt_storage_path) return { error: "Sem recibo." };

  const { data, error } = await supabase.storage
    .from("ir-receipts")
    .createSignedUrl(tx.receipt_storage_path, 300);
  if (error) return { error: error.message };
  return { url: data?.signedUrl };
}
