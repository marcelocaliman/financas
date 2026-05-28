import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import {
  calcProgressiveTax as calcFromTable,
  getAnnualTaxTable,
} from "@/services/ir/ir-tax-tables";
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
  const numDependents = (deps ?? []).length;
  const dependentsDeduction = numDependents * taxTable.dependentDeduction;

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

  // ============================================================
  // Modelo COMPLETO — soma deduções dedutíveis e aplica tabela
  // ============================================================
  const educacaoLimit = Math.max(1, eduPeople) * taxTable.educationLimitPerPerson;
  const educacaoLimitApplied = Math.min(educacao, educacaoLimit);

  // PGBL: limite 12% da renda tributável
  const pgblLimit = baseTributavelBruta * 0.12;
  const pgblLimitApplied = Math.min(pgblPrev, pgblLimit);

  const totalDeducoes =
    (inssAndOfficial + inssFromPay) +
    dependentsDeduction +
    educacaoLimitApplied +
    saude +
    pgblLimitApplied +
    pensao +
    outros;

  const baseCompleto = Math.max(0, baseTributavelBruta - totalDeducoes);
  const grossTaxCompletoBefore = calcFromTable(baseCompleto, taxTable.brackets);
  // Doações: até 6% do imposto devido (calculado ANTES da doação)
  const donationLimit = grossTaxCompletoBefore * 0.06;
  const donationsApplied = Math.min(donations, donationLimit);
  const grossTaxCompletoAfterDon = Math.max(0, grossTaxCompletoBefore - donationsApplied);
  // Redutor da Lei 15.270/2025 (a partir de 2026): zera imposto até R$ 60k/ano
  // anuais e decai linear até R$ 88.200/ano.
  const redutorCompleto = computeRedutorAnual(year, baseTributavelBruta, grossTaxCompletoAfterDon);
  const grossTaxCompleto = Math.max(0, grossTaxCompletoAfterDon - redutorCompleto);

  // ============================================================
  // Modelo SIMPLES — 20% até o limite, sem deduções
  // ============================================================
  const descontoPadrao = Math.min(baseTributavelBruta * taxTable.simplesPct, taxTable.simplesLimit);
  const baseSimples = Math.max(0, baseTributavelBruta - descontoPadrao);
  const grossTaxSimplesBefore = calcFromTable(baseSimples, taxTable.brackets);
  const redutorSimples = computeRedutorAnual(year, baseTributavelBruta, grossTaxSimplesBefore);
  const grossTaxSimples = Math.max(0, grossTaxSimplesBefore - redutorSimples);

  const irrfRetained = rendimentos.tributaveis.totalIrrf;

  const netDueCompleto = grossTaxCompleto - irrfRetained;
  const netDueSimples = grossTaxSimples - irrfRetained;

  const recommendation: "simples" | "completo" =
    netDueCompleto <= netDueSimples ? "completo" : "simples";
  const savings = Math.abs(netDueCompleto - netDueSimples);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    year,
    taxTableSource: taxTable.source,
    taxTableIsEstimate: taxTable.isEstimate,
    baseTributavelBruta: round2(baseTributavelBruta),
    inssAndOfficial: round2(inssAndOfficial + inssFromPay),
    dependentsDeduction: round2(dependentsDeduction),
    numDependents,
    completo: {
      educacao: round2(educacao),
      educacaoLimitApplied: round2(educacaoLimitApplied),
      saude: round2(saude),
      pgblPrev: round2(pgblPrev),
      pgblLimitApplied: round2(pgblLimitApplied),
      pensaoAlimenticia: round2(pensao),
      outros: round2(outros),
      donations: round2(donations),
      donationsLimit: round2(donationLimit),
      donationsApplied: round2(donationsApplied),
      totalDeducoes: round2(totalDeducoes),
      base: round2(baseCompleto),
      grossTax: round2(grossTaxCompleto),
      irrfRetained: round2(irrfRetained),
      netDue: round2(netDueCompleto),
    },
    simples: {
      descontoPadrao: round2(descontoPadrao),
      base: round2(baseSimples),
      grossTax: round2(grossTaxSimples),
      irrfRetained: round2(irrfRetained),
      netDue: round2(netDueSimples),
    },
    recommendation,
    savings: round2(savings),
  };
}

/**
 * Redutor anual instituído pela Lei 15.270/2025 (vigor a partir de
 * ano-calendário 2026).
 *
 * Lógica:
 *   - Renda anual ≤ R$ 60.000: redutor zera o imposto (limitado ao bruto).
 *   - R$ 60.000 < renda ≤ R$ 88.200: redutor decai linearmente até zero
 *     (proporcional ao quanto a renda excede R$ 60k em relação a R$ 28,2k
 *     de zona de transição).
 *   - Renda > R$ 88.200: redutor = 0.
 *
 * Sempre limitado a 0 ≤ redutor ≤ imposto_bruto (não gera crédito).
 *
 * @param year ano-base (só aplica a partir de 2026)
 * @param rendaAnualBruta rendimento tributável anual antes das deduções
 * @param impostoBruto imposto calculado pela tabela progressiva
 */
function computeRedutorAnual(
  year: number,
  rendaAnualBruta: number,
  impostoBruto: number,
): number {
  if (year < 2026) return 0;
  if (rendaAnualBruta <= 60_000) {
    return impostoBruto; // zera tudo
  }
  if (rendaAnualBruta >= 88_200) return 0;
  // Decaimento linear entre 60k e 88.200 — proporcional ao quanto sobrou
  // da zona de transição. Limitado ao imposto bruto.
  const fracao = (88_200 - rendaAnualBruta) / (88_200 - 60_000);
  const redutorMax = impostoBruto * fracao;
  return Math.max(0, Math.min(redutorMax, impostoBruto));
}
