"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/services/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDocumentUpload, saveReviewedData } from "@/services/inbox/document-uploads";
import { applyFaturaCartao } from "@/services/inbox/appliers/fatura-cartao";
import { applyHolerite } from "@/services/inbox/appliers/holerite";
import { applyNotaCorretagem } from "@/services/inbox/appliers/nota-corretagem";
import { applyReciboMedico } from "@/services/inbox/appliers/recibo-medico";
import { applyBoleto } from "@/services/inbox/appliers/boleto";
import { applyExtratoBancario } from "@/services/inbox/appliers/extrato-bancario";
import type {
  ExtractedData,
  FaturaCartao,
  Holerite,
  NotaCorretagem,
  ReciboMedico,
  Boleto,
  ExtratoBancario,
  DocumentType,
} from "@/services/inbox/document-types";

/**
 * Confirma um documento em review com proteção CAS (compare-and-swap)
 * contra double-click e race conditions.
 *
 * Fluxo:
 *  1. CAS: marca status='extracting' (reusa como "lock") só se status atual
 *     for 'review' ou 'error'. Se outro request marcou antes, retorna erro.
 *  2. Roda o applier
 *  3. Marca status='confirmed' ou volta pra 'review' em caso de falha.
 */
export type ConfirmDocumentArgs = {
  documentId: string;
  reviewedData?: ExtractedData["data"] | null;
  accountId?: string | null;
  ownerFilerId?: string | null;
  categoryId?: string | null;
};

export type ConfirmResult = {
  ok?: boolean;
  error?: string;
  createdIds?: Record<string, string[]>;
  skippedCount?: number;
};

/** Tipos de conta esperados por tipo de documento. */
const EXPECTED_ACCOUNT_TYPES: Record<DocumentType, string[]> = {
  fatura_cartao: ["credit_card"],
  holerite: ["checking", "savings"],
  boleto: ["checking", "savings", "cash"],
  extrato_bancario: ["checking", "savings", "investment", "cash"],
  nota_corretagem: ["investment"],
  recibo_medico: [],
  outros: [],
};

/** Helper pra evitar repetir o cast — types do Supabase ainda não conhecem document_uploads. */
type UpdateBuilder = {
  update: (row: Record<string, unknown>) => {
    eq: (c: string, v: string) => Promise<{ error: unknown }>;
  };
};
function updateUploadRow(admin: ReturnType<typeof createAdminClient>) {
  return (admin.from as unknown as (t: string) => UpdateBuilder)("document_uploads");
}

export async function confirmDocumentAction(args: ConfirmDocumentArgs): Promise<ConfirmResult> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const admin = createAdminClient();

  // CAS lock
  type CASBuilder = {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: unknown) => {
        in: (
          c: string,
          v: string[],
        ) => {
          select: (s: string) => Promise<{
            data: Array<{
              id: string;
              detected_type: DocumentType | null;
              extracted_data: ExtractedData["data"] | null;
              household_id: string;
            }> | null;
          }>;
        };
      };
    };
  };
  const { data: locked } = await (
    admin.from as unknown as (t: string) => CASBuilder
  )("document_uploads")
    .update({ status: "extracting" })
    .eq("id", args.documentId)
    .in("status", ["review", "error"])
    .select("id, detected_type, extracted_data, household_id");

  if (!locked || locked.length === 0) {
    const current = await getDocumentUpload(args.documentId);
    return {
      error: current
        ? `Documento já está em estado '${current.status}'. Atualize a página.`
        : "Documento não encontrado.",
    };
  }
  const doc = locked[0];
  if (doc.household_id !== ctx.household.id) {
    await updateUploadRow(admin)
      .update({ status: "review" })
      .eq("id", args.documentId);
    return { error: "Acesso negado." };
  }
  if (!doc.detected_type || !doc.extracted_data) {
    await updateUploadRow(admin)
      .update({ status: "error", error_message: "Documento sem dados extraídos." })
      .eq("id", args.documentId);
    return { error: "Documento sem dados extraídos. Tente re-extrair antes." };
  }

  // Validação: tipo de conta compatível
  const expectedTypes = EXPECTED_ACCOUNT_TYPES[doc.detected_type];
  if (args.accountId && expectedTypes.length > 0) {
    type AccTypeBuilder = {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: { type: string } | null }>;
        };
      };
    };
    const { data: acc } = await (
      admin.from as unknown as (t: string) => AccTypeBuilder
    )("accounts")
      .select("type")
      .eq("id", args.accountId)
      .maybeSingle();
    if (acc && !expectedTypes.includes(acc.type)) {
      await updateUploadRow(admin)
        .update({ status: "review" })
        .eq("id", args.documentId);
      return {
        error: `Tipo de conta incompatível: documento '${doc.detected_type}' espera ${expectedTypes.join("/")}, mas conta selecionada é '${acc.type}'.`,
      };
    }
  }

  const data = args.reviewedData ?? doc.extracted_data;
  if (args.reviewedData) {
    await saveReviewedData(args.documentId, args.reviewedData);
  }

  let result:
    | { ok: true; createdIds: Record<string, string[]>; skippedCount: number }
    | { ok: false; error: string };

  try {
    switch (doc.detected_type) {
      case "fatura_cartao": {
        if (!args.accountId) throw new Error("Escolha a conta do cartão.");
        const r = await applyFaturaCartao({
          householdId: ctx.household.id,
          userId: ctx.authId,
          documentId: args.documentId,
          data: data as FaturaCartao,
          accountId: args.accountId,
        });
        result = r.ok
          ? { ok: true, createdIds: { transactions: r.createdIds }, skippedCount: r.skippedCount }
          : r;
        break;
      }
      case "holerite": {
        if (!args.accountId) throw new Error("Escolha a conta onde o salário cai.");
        if (!args.ownerFilerId) throw new Error("Escolha o filer dono do salário.");
        const r = await applyHolerite({
          householdId: ctx.household.id,
          userId: ctx.authId,
          documentId: args.documentId,
          data: data as Holerite,
          accountId: args.accountId,
          ownerFilerId: args.ownerFilerId,
        });
        result = r.ok
          ? { ok: true, createdIds: r.createdIds, skippedCount: r.skipped ? 1 : 0 }
          : r;
        break;
      }
      case "nota_corretagem": {
        const r = await applyNotaCorretagem({
          householdId: ctx.household.id,
          userId: ctx.authId,
          documentId: args.documentId,
          data: data as NotaCorretagem,
          accountId: args.accountId ?? null,
        });
        result = r.ok
          ? { ok: true, createdIds: r.createdIds, skippedCount: r.skippedCount }
          : r;
        break;
      }
      case "recibo_medico": {
        if (!args.ownerFilerId) throw new Error("Escolha o filer dono do gasto.");
        const r = await applyReciboMedico({
          householdId: ctx.household.id,
          userId: ctx.authId,
          documentId: args.documentId,
          data: data as ReciboMedico,
          ownerFilerId: args.ownerFilerId,
        });
        result = r.ok
          ? {
              ok: true,
              createdIds: { ir_deductible_payments: r.createdIds },
              skippedCount: r.skipped ? 1 : 0,
            }
          : r;
        break;
      }
      case "boleto": {
        if (!args.accountId) throw new Error("Escolha a conta que vai pagar o boleto.");
        const r = await applyBoleto({
          householdId: ctx.household.id,
          userId: ctx.authId,
          documentId: args.documentId,
          data: data as Boleto,
          accountId: args.accountId,
          categoryId: args.categoryId,
        });
        result = r.ok
          ? {
              ok: true,
              createdIds: { transactions: r.createdIds },
              skippedCount: r.skipped ? 1 : 0,
            }
          : r;
        break;
      }
      case "extrato_bancario": {
        if (!args.accountId) throw new Error("Escolha a conta destino dos lançamentos.");
        const r = await applyExtratoBancario({
          householdId: ctx.household.id,
          userId: ctx.authId,
          documentId: args.documentId,
          data: data as ExtratoBancario,
          accountId: args.accountId,
        });
        result = r.ok
          ? { ok: true, createdIds: { transactions: r.createdIds }, skippedCount: r.skippedCount }
          : r;
        break;
      }
      case "outros":
        throw new Error("Tipo 'outros' não tem aplicador. Re-extraia ou descarte.");
      default:
        throw new Error(`Tipo não suportado: ${doc.detected_type}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateUploadRow(admin)
      .update({ status: "review", error_message: msg })
      .eq("id", args.documentId);
    return { error: msg };
  }

  if (!result.ok) {
    await updateUploadRow(admin)
      .update({ status: "review", error_message: result.error })
      .eq("id", args.documentId);
    return { error: result.error };
  }

  await updateUploadRow(admin)
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      applied_record_ids: result.createdIds as Record<string, unknown>,
    })
    .eq("id", args.documentId);

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  revalidatePath("/ir");
  revalidatePath("/investimentos");

  return {
    ok: true,
    createdIds: result.createdIds,
    skippedCount: result.skippedCount,
  };
}
