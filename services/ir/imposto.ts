import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import type { Currency, Tables } from "@/types/database";

/**
 * Cálculo do imposto devido / restituição.
 *
 * Compara automaticamente os dois modelos (Simples vs Completo) e
 * recomenda o mais vantajoso pro contribuinte.
 *
 * Tabela progressiva anual IRPF (2025/ano-base 2024 — sujeito a atualização):
 *   Até R$ 26.963,20                — isento
 *   R$ 26.963,21 a R$ 33.919,80     — 7,5% (parcela a deduzir: 2.022,24)
 *   R$ 33.919,81 a R$ 45.012,60     — 15% (parcela a deduzir: 4.566,23)
 *   R$ 45.012,61 a R$ 55.976,16     — 22,5% (parcela a deduzir: 7.942,17)
 *   Acima de R$ 55.976,16            — 27,5% (parcela a deduzir: 10.740,98)
 *
 * Desconto simples: 20% da base de cálculo, limitado a R$ 16.754,34 (ano-base 2024).
 * Dependente: R$ 2.275,08 por ano (ano-base 2024).
 *
 * As constantes vivem aqui — atualiza a cada ano-base nova.
 */

const TAX_BRACKETS = [
  { upTo: 26963.20, rate: 0, deduct: 0 },
  { upTo: 33919.80, rate: 0.075, deduct: 2022.24 },
  { upTo: 45012.60, rate: 0.15, deduct: 4566.23 },
  { upTo: 55976.16, rate: 0.225, deduct: 7942.17 },
  { upTo: Infinity, rate: 0.275, deduct: 10740.98 },
];

const SIMPLES_PCT = 0.20;
const SIMPLES_LIMIT = 16754.34;
const DEPENDENT_DEDUCTION = 2275.08;
const EDUCATION_LIMIT_PER_PERSON = 3561.50;

export type ImpostoResult = {
  year: number;
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

export function calcProgressiveTax(base: number): number {
  for (const b of TAX_BRACKETS) {
    if (base <= b.upTo) {
      return Math.max(0, base * b.rate - b.deduct);
    }
  }
  return 0;
}

export async function computeImposto(
  year: number,
  householdId?: string,
): Promise<ImpostoResult> {
  const supabase = await createClient();
  const rates = await getRateMapAt(`${year}-12-31`);

  const depsQuery = supabase.from("ir_dependents").select("id").eq("is_active", true);
  const paysQuery = supabase.from("ir_deductible_payments").select("*").eq("year", year);

  const [rendimentos, { data: deps }, { data: pagamentos }] = await Promise.all([
    getRendimentosReport(year, householdId),
    householdId ? depsQuery.eq("household_id", householdId) : depsQuery,
    householdId ? paysQuery.eq("household_id", householdId) : paysQuery,
  ]);

  const baseTributavelBruta = rendimentos.tributaveis.total;
  const inssAndOfficial = rendimentos.tributaveis.totalInss;
  const numDependents = (deps ?? []).length;
  const dependentsDeduction = numDependents * DEPENDENT_DEDUCTION;

  // Categorizar pagamentos dedutíveis
  let educacao = 0;
  let saude = 0;
  let pgblPrev = 0;
  let pensao = 0;
  let outros = 0;
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
        pensao += amt;
        break;
      case "inss_titular":
      case "inss_domestico":
        inssFromPay += amt;
        break;
      default:
        outros += amt;
    }
  }

  // ============================================================
  // Modelo COMPLETO — soma deduções dedutíveis e aplica tabela
  // ============================================================
  const educacaoLimit = Math.max(1, eduPeople) * EDUCATION_LIMIT_PER_PERSON;
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
  const grossTaxCompleto = calcProgressiveTax(baseCompleto);

  // ============================================================
  // Modelo SIMPLES — 20% até o limite, sem deduções
  // ============================================================
  const descontoPadrao = Math.min(baseTributavelBruta * SIMPLES_PCT, SIMPLES_LIMIT);
  const baseSimples = Math.max(0, baseTributavelBruta - descontoPadrao);
  const grossTaxSimples = calcProgressiveTax(baseSimples);

  const irrfRetained = rendimentos.tributaveis.totalIrrf;

  const netDueCompleto = grossTaxCompleto - irrfRetained;
  const netDueSimples = grossTaxSimples - irrfRetained;

  const recommendation: "simples" | "completo" =
    netDueCompleto <= netDueSimples ? "completo" : "simples";
  const savings = Math.abs(netDueCompleto - netDueSimples);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    year,
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
