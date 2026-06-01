import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import { getCarneLeaoSummary } from "@/services/ir/carne-leao";
import {
  calcProgressiveTax as calcFromTable,
  getAnnualTaxTable,
} from "@/services/ir/ir-tax-tables";
import { assembleImposto } from "@/services/ir/tax-math";
import type { IrWarning } from "@/services/ir/warnings";
import type { Currency, Tables } from "@/types/database";

/**
 * Cálculo do imposto devido / restituição.
 *
 * Compara automaticamente os dois modelos (Simples vs Completo) e
 * recomenda o mais vantajoso pro contribuinte.
 *
 * As tabelas progressivas (faixas, parcelas deduzíveis, limites do simples,
 * dedução por dependente, etc.) vivem no banco em `ir_tax_table_annual`.
 * Pra adicionar novo ano-base, basta INSERT na tabela — sem alteração de
 * código. Se o ano solicitado não estiver cadastrado, o cálculo lança
 * IRTaxTableNotFoundError com mensagem clara pro user.
 */

export type ImpostoResult = {
  year: number;
  /** Fonte da tabela usada (ex: "Lei 14.848/24") + flag se é estimativa */
  taxTableSource: string;
  taxTableIsEstimate: boolean;
  baseTributavelBruta: number; // soma de rendimentos tributáveis
  inssAndOfficial: number;
  dependentsDeduction: number;
  numDependents: number;
  /** Dedução por dependente vigente no ano-base (pra exibir hint sem hardcode) */
  dependentDeductionPerDep: number;
  /** Teto do desconto simplificado vigente no ano-base */
  simplesLimit: number;
  // Modelo Completo
  completo: {
    educacao: number;
    educacaoLimitApplied: number;
    saude: number; // sem limite
    pgblPrev: number; // limite 12% da renda
    pgblLimitApplied: number;
    pensaoAlimenticia: number;
    outros: number;
    donations: number;          // ECA + Lei Rouanet bruto
    donationsLimit: number;     // 6% do imposto devido
    donationsApplied: number;   // min(donations, donationsLimit)
    totalDeducoes: number;
    base: number;
    grossTax: number;
    irrfRetained: number;
    netDue: number; // positivo = devido, negativo = restituição
  };
  // Modelo Simples
  simples: {
    descontoPadrao: number;
    base: number;
    grossTax: number;
    irrfRetained: number;
    netDue: number;
  };
  recommendation: "simples" | "completo";
  savings: number; // diferença entre o pior e o melhor modelo
  /**
   * Rendimentos que o motor não classificou (ficam FORA da base). Total > 0
   * significa que a estimativa é PROVISÓRIA até o usuário revisar.
   */
  naoClassificadosTotal: number;
  /** Avisos tipados (renda não classificada, aluguel, tabela estimada). */
  warnings: IrWarning[];
};

/**
 * @deprecated Use calcProgressiveTax(base, brackets) do ir-tax-tables.ts.
 * Mantido como wrapper que carrega a tabela do ano atual pra retrocompat.
 */
export async function calcProgressiveTax(base: number, year?: number): Promise<number> {
  const y = year ?? new Date().getUTCFullYear();
  const table = await getAnnualTaxTable(y);
  return calcFromTable(base, table.brackets);
}

export async function computeImposto(
  year: number,
  householdId?: string,
  filerId?: string,
  /** Dependentes EXTRAS além dos cadastrados (ex: cônjuge na declaração
   *  conjunta, que entra como dependente e gera +1 dedução). */
  extraDependents = 0,
): Promise<ImpostoResult> {
  const supabase = await createClient();
  const rates = await getRateMapAt(`${year}-12-31`);

  // Carrega a tabela IRPF do ano-base solicitado. Throw com mensagem clara
  // se o ano não tiver tabela cadastrada — sem fallback silencioso.
  const taxTable = await getAnnualTaxTable(year);

  const depsQuery = supabase.from("ir_dependents").select("id").eq("is_active", true);
  const paysQuery = supabase.from("ir_deductible_payments").select("*").eq("year", year);

  // Quando declaração separada: deps + pagamentos atribuídos ao filer
  const scopedDeps = filerId ? depsQuery.eq("belongs_to_filer_id", filerId) : depsQuery;
  const scopedPays = filerId ? paysQuery.eq("owner_filer_id", filerId) : paysQuery;

  const [rendimentos, { data: deps }, { data: pagamentos }] = await Promise.all([
    getRendimentosReport(year, householdId, filerId),
    householdId ? scopedDeps.eq("household_id", householdId) : scopedDeps,
    householdId ? scopedPays.eq("household_id", householdId) : scopedPays,
  ]);

  const baseTributavelBruta = rendimentos.tributaveis.total;
  const inssAndOfficial = rendimentos.tributaveis.totalInss;
  const numDependents = (deps ?? []).length + Math.max(0, extraDependents);

  // Categorizar pagamentos dedutíveis
  let educacao = 0;
  let saude = 0;
  let pgblPrev = 0;
  let pensao = 0;
  let outros = 0;
  let donations = 0; // ECA + Lei Rouanet — limite 6% do imposto devido
  let inssFromPay = 0;
  let eduPeople = 0; // pra aplicar limite por pessoa

  for (const p of (pagamentos ?? []) as Tables<"ir_deductible_payments">[]) {
    const amt = convertOrSame(Number(p.amount), p.currency as Currency, "BRL", rates);
    switch (p.kind) {
      case "educacao_titular":
      case "educacao_dependente":
        educacao += amt;
        eduPeople++;
        break;
      case "plano_saude":
      case "hospital":
      case "medico":
      case "dentista":
      case "psicologo":
      case "outros_saude":
        saude += amt;
        break;
      case "pgbl":
      case "previdencia_privada":
        pgblPrev += amt;
        break;
      case "pensao_alimenticia":
      case "honorarios_advocaticios_pensao":
        // Honorários pra obter pensão são dedutíveis junto com pensão paga
        // (IN RFB 1.500/14 art. 18)
        pensao += amt;
        break;
      case "inss_titular":
      case "inss_domestico":
        inssFromPay += amt;
        break;
      case "doacao_eca":
      case "doacao_cultural":
        // Doações são abatidas do IMPOSTO devido, não da renda. Limite 6% (Lei 9.250/95 art. 22).
        donations += amt;
        break;
      default:
        outros += amt;
    }
  }

  const irrfRetained = rendimentos.tributaveis.totalIrrf;

  // Carnê-leão (DARF 0190) é antecipação do imposto anual — creditado igual ao
  // IRRF. Credita só o que foi RECOLHIDO (marcado como pago), igual à declaração
  // oficial: o que está pendente continua aparecendo como imposto a pagar.
  // Escopo por filer na declaração separada (carne_leao_mensal tem filer_id),
  // alinhado com a inclusão da renda na base em getRendimentosReport.
  const carneLeaoCredit = (await getCarneLeaoSummary(year, householdId, filerId)).totalPaid;

  // Núcleo PURO do cálculo (Simples vs Completo + redutor + créditos).
  const math = assembleImposto({
    year,
    baseTributavelBruta,
    inssAndOfficial,
    numDependents,
    deductions: { educacao, eduPeople, saude, pgblPrev, pensao, outros, donations, inssFromPay },
    irrfRetained,
    carneLeaoCredit,
    taxTable,
  });

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Avisos: os do motor de rendimentos + tabela estimada (rollforward).
  const warnings: IrWarning[] = [...rendimentos.warnings];
  if (taxTable.isEstimate) {
    warnings.push({
      code: "tabela_estimada",
      severity: "atencao",
      message: `A tabela do IRPF ${year} ainda é estimada (${taxTable.source}). O valor pode mudar quando a tabela oficial for publicada.`,
    });
  }

  return {
    year,
    taxTableSource: taxTable.source,
    taxTableIsEstimate: taxTable.isEstimate,
    baseTributavelBruta: round2(baseTributavelBruta),
    inssAndOfficial: round2(inssAndOfficial + inssFromPay),
    dependentsDeduction: round2(math.dependentsDeduction),
    numDependents,
    dependentDeductionPerDep: round2(taxTable.dependentDeduction),
    simplesLimit: round2(taxTable.simplesLimit),
    completo: {
      educacao: round2(educacao),
      educacaoLimitApplied: round2(math.completo.educacaoLimitApplied),
      saude: round2(saude),
      pgblPrev: round2(pgblPrev),
      pgblLimitApplied: round2(math.completo.pgblLimitApplied),
      pensaoAlimenticia: round2(pensao),
      outros: round2(outros),
      donations: round2(donations),
      donationsLimit: round2(math.completo.donationsLimit),
      donationsApplied: round2(math.completo.donationsApplied),
      totalDeducoes: round2(math.completo.totalDeducoes),
      base: round2(math.completo.base),
      grossTax: round2(math.completo.grossTax),
      irrfRetained: round2(irrfRetained),
      netDue: round2(math.completo.netDue),
    },
    simples: {
      descontoPadrao: round2(math.simples.descontoPadrao),
      base: round2(math.simples.base),
      grossTax: round2(math.simples.grossTax),
      irrfRetained: round2(irrfRetained),
      netDue: round2(math.simples.netDue),
    },
    recommendation: math.recommendation,
    savings: round2(math.savings),
    naoClassificadosTotal: round2(rendimentos.naoClassificados.total),
    warnings,
  };
}
