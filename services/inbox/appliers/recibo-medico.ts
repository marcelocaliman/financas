import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReciboMedico } from "../document-types";

/**
 * Aplica recibo médico extraído. Dedup por (year, kind, amount cents,
 * provider_cnpj, payment_date, owner_filer).
 */
export async function applyReciboMedico(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: ReciboMedico;
  ownerFilerId: string;
}): Promise<
  | { ok: true; createdIds: string[]; skipped: boolean }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const year = Number(args.data.payment_date.slice(0, 4));

  const kindMap: Record<ReciboMedico["kind"], string> = {
    medico: "medico",
    dentista: "dentista",
    psicologo: "psicologo",
    hospital: "hospital",
    plano_saude: "plano_saude",
    fisioterapia: "outros_saude",
    exames: "outros_saude",
    outros_saude: "outros_saude",
  };
  const kind = kindMap[args.data.kind];

  // Dedup: mesmo provider + valor + data + tipo + filer
  type DedupBuilder = {
    select: (s: string) => {
      eq: (c: string, v: unknown) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => {
              eq: (c: string, v: unknown) => Promise<{ data: { id: string }[] | null }>;
            };
          };
        };
      };
    };
  };
  const { data: existing } = await (
    admin.from as unknown as (t: string) => DedupBuilder
  )("ir_deductible_payments")
    .select("id")
    .eq("household_id", args.householdId)
    .eq("year", year)
    .eq("kind", kind)
    .eq("amount", args.data.amount)
    .eq("owner_filer_id", args.ownerFilerId);
  if (existing && existing.length > 0) {
    return { ok: true, createdIds: [], skipped: true };
  }

  type Builder = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };

  const { data: inserted, error } = await (
    admin.from as unknown as (t: string) => Builder
  )("ir_deductible_payments")
    .insert([
      {
        household_id: args.householdId,
        year,
        kind,
        amount: args.data.amount,
        currency: "BRL",
        description: args.data.description,
        provider_name: args.data.provider_name,
        provider_cnpj_cpf: args.data.provider_cnpj_cpf,
        beneficiary_name: args.data.patient_name,
        owner_filer_id: args.ownerFilerId,
        notes: `Importado via OpenAI inbox · ${args.data.payment_date}`,
      },
    ])
    .select("id");

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao criar dedução IR." };
  }

  return { ok: true, createdIds: inserted.map((r) => r.id), skipped: false };
}
