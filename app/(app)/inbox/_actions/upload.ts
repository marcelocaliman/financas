"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/services/auth";
import {
  createDocumentUpload,
  markExtracting,
  markExtracted,
  markExtractionError,
  downloadDocumentContent,
  getDocumentUpload,
} from "@/services/inbox/document-uploads";
import { extractDocument } from "@/services/inbox/extract-document";
import { isOpenAIConfigured } from "@/lib/openai/client";
import { enforceAiQuota } from "@/lib/ai-quota";
import { EntitlementError } from "@/services/entitlements";
import type { DocumentType } from "@/services/inbox/document-types";

const VALID_TYPES: DocumentType[] = [
  "fatura_cartao",
  "holerite",
  "nota_corretagem",
  "recibo_medico",
  "boleto",
  "extrato_bancario",
  "outros",
];

function parseForceType(raw: unknown): DocumentType | undefined {
  if (typeof raw !== "string") return undefined;
  return VALID_TYPES.includes(raw as DocumentType) ? (raw as DocumentType) : undefined;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Detecta o mime-type REAL pelos magic bytes (não confia no file.type do
 * client, que é falsificável). Retorna null se não for um tipo aceito.
 */
function sniffMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (["heic", "heix", "mif1", "hevc", "msf1", "heim", "heis"].includes(brand)) return "image/heic";
  }
  return null;
}

/**
 * Server action principal: recebe um arquivo, salva no storage, dispara
 * extração via OpenAI, retorna o id pra UI redirecionar pra review.
 */
export async function uploadAndExtractAction(
  formData: FormData,
): Promise<{ ok?: boolean; documentId?: string; error?: string }> {
  if (!isOpenAIConfigured()) {
    return {
      error:
        "OpenAI ainda não configurado. Adicione OPENAI_API_KEY no .env.local pra ativar o Inbox.",
    };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  try {
    await enforceAiQuota("inbox-upload");
  } catch (e) {
    if (e instanceof EntitlementError) return { error: e.message };
    throw e;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Arquivo não recebido." };
  }
  if (file.size === 0) {
    return { error: "Arquivo vazio." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Arquivo muito grande (máximo 15 MB)." };
  }

  const forceType = parseForceType(formData.get("forceType"));
  const buffer = Buffer.from(await file.arrayBuffer());

  // Valida o tipo REAL pelos magic bytes (não confia no file.type do client).
  const realMime = sniffMimeType(buffer);
  if (!realMime) {
    return {
      error: "Tipo de arquivo não suportado. Envie PDF ou imagem (JPG, PNG, WEBP, HEIC).",
    };
  }

  const created = await createDocumentUpload({
    householdId: ctx.household.id,
    uploadedBy: ctx.authId,
    fileContent: buffer,
    originalFilename: file.name,
    mimeType: realMime,
  });

  if ("error" in created) {
    return { error: created.error };
  }

  // Dispara a extração imediatamente (síncrono — pra UX simples).
  // Se ficar lento no futuro, dá pra mover pra cron/background.
  await markExtracting(created.id);

  try {
    const result = await extractDocument({
      file: {
        content: buffer,
        mimeType: realMime,
        name: file.name,
      },
      forceType,
    });

    if ("error" in result) {
      await markExtractionError(created.id, result.error);
      return { error: result.error };
    }

    await markExtracted(created.id, {
      detectedType: result.detected_type,
      extractedData: result.data,
      usage: result.usage,
    });
  } catch (e) {
    await markExtractionError(
      created.id,
      e instanceof Error ? e.message : "Falha na extração.",
    );
    return {
      error: e instanceof Error ? e.message : "Falha na extração.",
    };
  }

  revalidatePath("/inbox");
  return { ok: true, documentId: created.id };
}

/**
 * Re-roda extração pra um documento existente (ex: usuário viu que detectou
 * tipo errado e quer tentar de novo).
 */
export async function reextractAction(
  documentId: string,
  forceTypeRaw?: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isOpenAIConfigured()) {
    return { error: "OpenAI não configurado." };
  }
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const doc = await getDocumentUpload(documentId);
  if (!doc) return { error: "Documento não encontrado." };
  // Authz: sem isso, qualquer usuário autenticado que saiba o UUID dispararia
  // re-extração (custo OpenAI + sobrescreve dados) de doc de outro household.
  if (doc.household_id !== ctx.household.id) return { error: "Acesso negado." };

  const buffer = await downloadDocumentContent(doc.storage_path);
  if (!buffer) return { error: "Falha ao baixar arquivo do storage." };

  const forceType = parseForceType(forceTypeRaw);

  await markExtracting(documentId);
  try {
    const result = await extractDocument({
      file: { content: buffer, mimeType: doc.mime_type, name: doc.original_filename },
      forceType,
    });
    if ("error" in result) {
      await markExtractionError(documentId, result.error);
      return { error: result.error };
    }
    await markExtracted(documentId, {
      detectedType: result.detected_type,
      extractedData: result.data,
      usage: result.usage,
    });
  } catch (e) {
    await markExtractionError(
      documentId,
      e instanceof Error ? e.message : "Falha na extração.",
    );
    return { error: e instanceof Error ? e.message : "Falha na extração." };
  }

  revalidatePath(`/inbox/${documentId}`);
  return { ok: true };
}
