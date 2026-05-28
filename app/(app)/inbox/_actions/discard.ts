"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/services/auth";
import { getDocumentUpload, markDiscarded } from "@/services/inbox/document-uploads";

export async function discardDocumentAction(
  documentId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const doc = await getDocumentUpload(documentId);
  if (!doc) return { error: "Documento não encontrado." };
  if (doc.household_id !== ctx.household.id) return { error: "Acesso negado." };

  await markDiscarded(documentId);
  revalidatePath("/inbox");
  return { ok: true };
}
