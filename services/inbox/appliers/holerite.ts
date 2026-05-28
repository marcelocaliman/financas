import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Holerite } from "../document-types";

/**
 * Aplica um holerite extraído:
 *   1. Cria 1 transaction de receita (salário líquido) na conta destino
 *   2. Atualiza/cria entrada em ir_other_incomes (rendimento tributável)
 *      com gross_salary, IRRF retido, INSS retido
 *
 * Marca metadata.source='openai_inbox' pra rastreabilidade.
 */
export async function applyHolerite(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: Holerite;
  /** Conta corrente onde o salário cai */
  accountId: string;
  /** Filer dono do salário (Marcelo ou Aline) */
  ownerFilerId: string;
}): Promise<
  | { ok: true; createdIds: { transactions: string[]; ir_other_incomes: string[] } }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();

  // 1. Transaction de receita (salário líquido)
  const competence = args.data.competence_month + "-01";
  const txDate = args.data.payment_date ?? `${args.data.competence_month}-05`;

  type TxBuilder = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  const { data: txInserted, error: txError } = await (
    admin.from as unknown as (t: string) => TxBuilder
  )("transactions")
    .insert([
      {
        household_id: args.householdId,
        created_by: args.userId,
        account_id: args.accountId,
        kind: "income",
        date: txDate,
        description: `Salário ${args.data.employee_name}${args.data.is_thirteenth ? " (13º)" : ""}`,
        amount: args.data.gross_salary,
        amount_account: args.data.net_salary,
        currency: "BRL",
        irrf_amount: args.data.irrf_retained,
        inss_amount: args.data.inss_retained,
        exclude_from_ir: false,
        is_historical_ir_only: false,
        is_recurring: false,
        metadata: {
          source: "openai_inbox",
          document_id: args.documentId,
          competence: args.data.competence_month,
          payer_cnpj: args.data.payer_cnpj,
          gross_salary: args.data.gross_salary,
          net_salary: args.data.net_salary,
          other_deductions: args.data.other_deductions,
          is_thirteenth: args.data.is_thirteenth,
        },
      },
    ])
    .select("id");

  if (txError || !txInserted) {
    return { ok: false, error: txError?.message ?? "Falha ao criar transação do salário." };
  }

  // 2. Entrada em ir_other_incomes
  const year = Number(args.data.competence_month.slice(0, 4));
  type IrBuilder = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  const description = `Salário ${args.data.employee_name} · competência ${args.data.competence_month}${args.data.is_thirteenth ? " · 13º" : ""}`;

  const { data: irInserted } = await (
    admin.from as unknown as (t: string) => IrBuilder
  )("ir_other_incomes")
    .insert([
      {
        household_id: args.householdId,
        year,
        category: args.data.is_thirteenth ? "exclusivo_fonte" : "tributavel_pj",
        description,
        source_name: args.data.payer_name,
        source_cnpj_cpf: args.data.payer_cnpj,
        gross_amount: args.data.gross_salary,
        irrf_amount: args.data.irrf_retained,
        inss_amount: args.data.inss_retained,
        thirteenth_amount: args.data.is_thirteenth ? args.data.gross_salary : 0,
        currency: "BRL",
        owner_filer_id: args.ownerFilerId,
        notes: `Importado via OpenAI inbox · ${competence}`,
      },
    ])
    .select("id");

  return {
    ok: true,
    createdIds: {
      transactions: txInserted.map((r) => r.id),
      ir_other_incomes: irInserted?.map((r) => r.id) ?? [],
    },
  };
}
