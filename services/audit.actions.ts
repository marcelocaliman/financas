"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Server actions chamadas pelos botões "fix" do dashboard de auditoria.
 *
 * Cada action é idempotente — pode ser chamada várias vezes sem efeito
 * colateral (verifica antes de inserir/atualizar).
 */

/**
 * Pra cada investimento liquidado no ano corrente sem entry em ir_other_incomes,
 * cria automaticamente um lançamento de "Rendimentos Sujeitos a Tributação
 * Exclusiva" com o IR retido na fonte que o broker já cobrou.
 *
 * Cálculo do rendimento bruto:
 *   gross_amount = gross_proceeds_on_close - initial_amount
 *   irrf_amount = ir_withheld_on_close
 *
 * Fonte = "Tesouro Nacional" pra Tesouro, "Brokerage" pra outros.
 */
export async function generateExclusiveIncomeFromClosures(): Promise<{
  ok?: boolean;
  generated?: number;
  error?: string;
}> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  // Investimentos liquidados no ano corrente
  const { data: closed, error: e1 } = await supabase
    .from("investments")
    .select(
      "id, ticker, name, asset_type, initial_amount, gross_proceeds_on_close, ir_withheld_on_close, closed_at, closed_reason, cnpj, owner_filer_id",
    )
    .eq("household_id", ctx.household.id)
    .not("closed_at", "is", null)
    .gte("closed_at", `${currentYear}-01-01`)
    .lte("closed_at", `${currentYear}-12-31`);
  if (e1) return { error: e1.message };

  let generated = 0;
  for (const c of closed ?? []) {
    if (!c.gross_proceeds_on_close || Number(c.gross_proceeds_on_close) <= 0) continue;

    // Idempotência: a description SEMPRE carrega o ticker no formato
    // "Rendimento exclusivo fonte · <TICKER> · liquidação <DD/MM/AAAA>".
    // Usar source_name não funciona pra TD (vira "Tesouro Nacional" pra todos).
    const { count } = await supabase
      .from("ir_other_incomes")
      .select("id", { count: "exact", head: true })
      .eq("household_id", ctx.household.id)
      .eq("year", currentYear)
      .eq("category", "exclusivo_fonte")
      .like("description", `%${c.ticker}%`);
    if ((count ?? 0) > 0) continue; // já existe, pula

    const rendimentoBruto = Math.max(
      0,
      Number(c.gross_proceeds_on_close) - Number(c.initial_amount),
    );
    const irrf = Number(c.ir_withheld_on_close ?? 0);

    // Fonte pagadora: Tesouro Nacional pra Tesouro Direto, senão usa o CNPJ do ativo
    const isTesouroDireto = c.asset_type === "fixed_income_public";
    const sourceName = isTesouroDireto ? "Tesouro Nacional" : c.name;
    const sourceCnpj = isTesouroDireto ? "00.394.460/0001-41" : c.cnpj;

    const closedAtDate = (c.closed_at as string).slice(0, 10);
    const description = `Rendimento exclusivo fonte · ${c.ticker} · liquidação ${closedAtDate.split("-").reverse().join("/")}`;

    const { error: insErr } = await supabase.from("ir_other_incomes").insert({
      household_id: ctx.household.id,
      year: currentYear,
      category: "exclusivo_fonte",
      description,
      source_name: sourceName,
      source_cnpj_cpf: sourceCnpj,
      gross_amount: Math.round(rendimentoBruto * 100) / 100,
      irrf_amount: Math.round(irrf * 100) / 100,
      inss_amount: 0,
      thirteenth_amount: 0,
      currency: "BRL",
      owner_filer_id: c.owner_filer_id,
      notes: `Gerado automaticamente pela auditoria a partir do fechamento do ativo (${c.closed_reason}).`,
    });
    if (!insErr) generated++;
  }

  revalidatePath("/configuracoes/auditoria");
  revalidatePath(`/ir/${currentYear}`);
  return { ok: true, generated };
}
