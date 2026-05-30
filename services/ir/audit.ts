import "server-only";
import { getBensReport } from "@/services/ir/bens";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import { computeImposto } from "@/services/ir/imposto";
import { createClient } from "@/lib/supabase/server";
import { getRateMapAt } from "@/services/currency";
import { convertOrSame } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";

/**
 * Relatório de auditoria pré-fechamento — agrega o que o app calculou pra cada
 * ficha da declaração IRPF. O usuário cola os valores oficiais (informes XP,
 * banco, plano de saúde, contador) ao lado pra ver divergências.
 *
 * Útil em jan-fev/ano-seguinte, quando os informes oficiais são emitidos.
 */
export type AuditTotals = {
  year: number;
  // Identificação
  filerCount: number;
  dependentCount: number;
  // Rendimentos
  rendimentosTributaveisPJ: number;
  rendimentosIsentos: number;
  rendimentosExclusivos: number;
  totalRendimentos: number;
  // Imposto retido
  totalIrrf: number;
  totalInss: number;
  // Bens
  bensTotalAtual: number;
  bensTotalAnterior: number;
  bensCount: number;
  // Dívidas
  dividasTotalAtual: number;
  dividasDeclarableCount: number;
  // Dedutíveis
  deductiblesTotal: number;
  deductiblesByKind: Record<string, number>;
  // Imposto
  impostoSimples: number;
  impostoCompleto: number;
  recomendacao: "simples" | "completo";
};

export async function getAuditTotals(
  year: number,
  householdId?: string,
): Promise<AuditTotals> {
  const supabase = await createClient();

  const [bens, rendimentos, imposto, { data: filers }, { data: deps }, { data: deds }, rates] =
    await Promise.all([
      getBensReport(year, householdId),
      getRendimentosReport(year, householdId),
      computeImposto(year, householdId),
      supabase.from("ir_filers").select("id").eq("is_active", true),
      supabase.from("ir_dependents").select("id").eq("is_active", true),
      supabase
        .from("ir_deductible_payments")
        .select("kind, amount, currency")
        .eq("year", year),
      // cotação de 31/12 do ano-base, igual ao cálculo do imposto
      getRateMapAt(`${year}-12-31`),
    ]);

  const deductiblesByKind: Record<string, number> = {};
  let deductiblesTotal = 0;
  for (const d of deds ?? []) {
    // Converte pra BRL (alinha com computeImposto) — antes somava moedas cruas.
    const amt = convertOrSame(Number(d.amount), (d.currency ?? "BRL") as Currency, "BRL", rates);
    deductiblesByKind[d.kind] = (deductiblesByKind[d.kind] ?? 0) + amt;
    deductiblesTotal += amt;
  }

  return {
    year,
    filerCount: filers?.length ?? 0,
    dependentCount: deps?.length ?? 0,
    rendimentosTributaveisPJ: rendimentos.tributaveis.total,
    rendimentosIsentos: rendimentos.isentos.total,
    rendimentosExclusivos: rendimentos.exclusivos.total,
    totalRendimentos:
      rendimentos.tributaveis.total +
      rendimentos.isentos.total +
      rendimentos.exclusivos.total,
    totalIrrf: rendimentos.tributaveis.totalIrrf,
    totalInss: rendimentos.tributaveis.totalInss,
    bensTotalAtual: bens.totals.current,
    bensTotalAnterior: bens.totals.previous,
    bensCount: bens.byGroup.reduce((s, g) => s + g.items.length, 0),
    dividasTotalAtual: bens.dividas.totalCurrent,
    dividasDeclarableCount: bens.dividas.declarableCount,
    deductiblesTotal: Math.round(deductiblesTotal * 100) / 100,
    deductiblesByKind,
    impostoSimples: imposto.simples.netDue,
    impostoCompleto: imposto.completo.netDue,
    recomendacao: imposto.recommendation,
  };
}
