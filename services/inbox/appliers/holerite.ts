import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Holerite } from "../document-types";
import { computeAmountAccount } from "../currency-convert";
import type { Currency } from "@/types/database";

/**
 * Aplica holerite extraído.
 *
 * Dedup: por (year, competence_month, payer_cnpj, owner_filer_id, is_thirteenth).
 * Se já existe transação OU lançamento IR pra esse mês+empresa+filer, pula.
 */
export async function applyHolerite(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: Holerite;
  accountId: string;
  ownerFilerId: string;
}): Promise<
  | {
      ok: true;
      createdIds: { transactions: string[]; ir_other_incomes: string[] };
      skipped: boolean;
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const year = Number(args.data.competence_month.slice(0, 4));
  const competence = `${args.data.competence_month}-01`;
  const txDate = args.data.payment_date ?? `${args.data.competence_month}-05`;
  const docCurrency = (args.data.currency ?? "BRL") as Currency;

  // Moeda da conta destino — pra computar amount_account
  type AccBuilder = {
    select: (s: string) => {
      eq: (
        c: string,
        v: string,
      ) => { maybeSingle: () => Promise<{ data: { currency: Currency } | null }> };
    };
  };
  const { data: acc } = await (
    supabase.from as unknown as (t: string) => AccBuilder
  )("accounts")
    .select("currency")
    .eq("id", args.accountId)
    .maybeSingle();
  const accountCurrency = (acc?.currency ?? "BRL") as Currency;
  const netSalaryConverted = await computeAmountAccount({
    amount: args.data.net_salary,
    fromCurrency: docCurrency,
    accountCurrency,
    date: txDate,
  });

  // Marco zero — salário com txDate pré-marco vira histórica-IR
  type HhBuilder = {
    select: (s: string) => {
      eq: (
        c: string,
        v: string,
      ) => { maybeSingle: () => Promise<{ data: { app_start_date: string } | null }> };
    };
  };
  const { data: hh } = await (
    supabase.from as unknown as (t: string) => HhBuilder
  )("households")
    .select("app_start_date")
    .eq("id", args.householdId)
    .maybeSingle();
  const appStartDate = hh?.app_start_date ?? null;
  const isHistorical = appStartDate ? txDate < appStartDate : false;

  // Dedup: checa se já existe ir_other_income com mesmas chaves
  type ExistingBuilder = {
    select: (s: string) => {
      eq: (c: string, v: unknown) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => {
            like: (c: string, p: string) => Promise<{ data: { id: string }[] | null }>;
          };
        };
      };
    };
  };
  const { data: existing } = await (
    admin.from as unknown as (t: string) => ExistingBuilder
  )("ir_other_incomes")
    .select("id")
    .eq("household_id", args.householdId)
    .eq("year", year)
    .eq("owner_filer_id", args.ownerFilerId)
    .like(
      "description",
      `%${args.data.employee_name}%competência ${args.data.competence_month}%${args.data.is_thirteenth ? "13º" : ""}%`,
    );

  if (existing && existing.length > 0) {
    return {
      ok: true,
      createdIds: { transactions: [], ir_other_incomes: [] },
      skipped: true,
    };
  }

  // 1. Transaction de receita (salário líquido)
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
        amount_account: netSalaryConverted,
        currency: docCurrency,
        irrf_amount: args.data.irrf_retained,
        inss_amount: args.data.inss_retained,
        exclude_from_ir: false,
        is_historical_ir_only: isHistorical,
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
        currency: docCurrency,
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
    skipped: false,
  };
}
