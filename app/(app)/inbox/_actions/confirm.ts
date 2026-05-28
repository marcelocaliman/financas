"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/services/auth";
import {
  getDocumentUpload,
  markConfirmed,
  saveReviewedData,
} from "@/services/inbox/document-uploads";
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
} from "@/services/inbox/document-types";

/**
 * Confirma um documento em review: roda o applier correspondente ao tipo
 * detectado, aplicando os dados nas tabelas reais. Marca status=confirmed
 * e guarda os IDs criados em applied_record_ids.
 *
 * Recebe os dados EDITADOS pelo user (reviewedData) — se omitido, usa
 * extracted_data como veio da IA.
 */
export type ConfirmDocumentArgs = {
  documentId: string;
  /** Dados após edição manual (ou null pra usar extracted_data). */
  reviewedData?: ExtractedData["data"] | null;
  /** Conta destino quando aplicável (fatura, holerite, boleto, extrato). */
  accountId?: string | null;
  /** Filer dono (holerite, recibo médico). */
  ownerFilerId?: string | null;
  /** Categoria opcional (boleto). */
  categoryId?: string | null;
};

export async function confirmDocumentAction(
  args: ConfirmDocumentArgs,
): Promise<{ ok?: boolean; error?: string; createdIds?: Record<string, string[]> }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const doc = await getDocumentUpload(args.documentId);
  if (!doc) return { error: "Documento não encontrado." };
  if (doc.household_id !== ctx.household.id) {
    return { error: "Acesso negado." };
  }
  if (doc.status !== "review" && doc.status !== "error") {
    return { error: `Documento já está com status '${doc.status}'.` };
  }
  if (!doc.detected_type || !doc.extracted_data) {
    return { error: "Documento sem dados extraídos. Tente re-extrair antes." };
  }

  const data = args.reviewedData ?? doc.extracted_data;

  // Persistir edição manual antes de aplicar (rastreabilidade)
  if (args.reviewedData) {
    await saveReviewedData(args.documentId, args.reviewedData);
  }

  let result:
    | { ok: true; createdIds: Record<string, string[]> }
    | { ok: false; error: string };

  switch (doc.detected_type) {
    case "fatura_cartao": {
      if (!args.accountId) return { error: "Escolha a conta do cartão." };
      const r = await applyFaturaCartao({
        householdId: ctx.household.id,
        userId: ctx.authId,
        documentId: args.documentId,
        data: data as FaturaCartao,
        accountId: args.accountId,
      });
      result = r.ok ? { ok: true, createdIds: { transactions: r.createdIds } } : r;
      break;
    }
    case "holerite": {
      if (!args.accountId) return { error: "Escolha a conta onde o salário cai." };
      if (!args.ownerFilerId) return { error: "Escolha o filer dono do salário." };
      const r = await applyHolerite({
        householdId: ctx.household.id,
        userId: ctx.authId,
        documentId: args.documentId,
        data: data as Holerite,
        accountId: args.accountId,
        ownerFilerId: args.ownerFilerId,
      });
      result = r.ok ? { ok: true, createdIds: r.createdIds } : r;
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
      result = r.ok ? { ok: true, createdIds: r.createdIds } : r;
      break;
    }
    case "recibo_medico": {
      if (!args.ownerFilerId) return { error: "Escolha o filer dono do gasto." };
      const r = await applyReciboMedico({
        householdId: ctx.household.id,
        userId: ctx.authId,
        documentId: args.documentId,
        data: data as ReciboMedico,
        ownerFilerId: args.ownerFilerId,
      });
      result = r.ok
        ? { ok: true, createdIds: { ir_deductible_payments: r.createdIds } }
        : r;
      break;
    }
    case "boleto": {
      if (!args.accountId) return { error: "Escolha a conta que vai pagar o boleto." };
      const r = await applyBoleto({
        householdId: ctx.household.id,
        userId: ctx.authId,
        documentId: args.documentId,
        data: data as Boleto,
        accountId: args.accountId,
        categoryId: args.categoryId,
      });
      result = r.ok ? { ok: true, createdIds: { transactions: r.createdIds } } : r;
      break;
    }
    case "extrato_bancario": {
      if (!args.accountId) return { error: "Escolha a conta destino dos lançamentos." };
      const r = await applyExtratoBancario({
        householdId: ctx.household.id,
        userId: ctx.authId,
        documentId: args.documentId,
        data: data as ExtratoBancario,
        accountId: args.accountId,
      });
      result = r.ok ? { ok: true, createdIds: { transactions: r.createdIds } } : r;
      break;
    }
    case "outros": {
      return { error: "Tipo 'outros' não tem aplicador automático. Reextraia como outro tipo ou descarte." };
    }
    default:
      return { error: `Tipo não suportado: ${doc.detected_type}` };
  }

  if (!result.ok) return { error: result.error };

  await markConfirmed(args.documentId, result.createdIds);

  // Revalidação ampla — qualquer página que mostre dados afetados precisa atualizar
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  revalidatePath("/ir");
  revalidatePath("/investimentos");

  return { ok: true, createdIds: result.createdIds };
}
