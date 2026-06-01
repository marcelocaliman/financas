import { calcProgressiveTax } from "@/services/ir/ir-tax-tables";
import type { AnnualTaxTable } from "@/services/ir/ir-tax-tables";

/**
 * Núcleo PURO do cálculo do imposto (Simples vs Completo). Extraído de
 * computeImposto pra ser testável sem banco (golden tests por perfil). A
 * busca de dados continua em computeImposto; aqui é só aritmética.
 *
 * IMPORTANTE: este módulo reproduz EXATAMENTE a matemática anterior — os
 * números de imposto não mudam, só ganham cobertura de teste.
 */

export interface ImpostoDeductions {
  educacao: number;
  eduPeople: number;
  saude: number;
  pgblPrev: number;
  pensao: number;
  outros: number;
  donations: number;
  inssFromPay: number;
}

export interface ImpostoMathInput {
  year: number;
  baseTributavelBruta: number;
  inssAndOfficial: number;
  numDependents: number;
  deductions: ImpostoDeductions;
  irrfRetained: number;
  carneLeaoCredit: number;
  taxTable: AnnualTaxTable;
}

export interface ImpostoModel {
  base: number;
  grossTax: number;
  netDue: number;
}

export interface ImpostoMathResult {
  dependentsDeduction: number;
  completo: {
    educacaoLimitApplied: number;
    pgblLimitApplied: number;
    totalDeducoes: number;
    donationsLimit: number;
    donationsApplied: number;
    base: number;
    grossTax: number;
    netDue: number;
  };
  simples: {
    descontoPadrao: number;
    base: number;
    grossTax: number;
    netDue: number;
  };
  recommendation: "simples" | "completo";
  savings: number;
}

// Redutor anual da Lei 15.270/2025. ⚠️ CONFERIR contra o texto publicado
// (coeficientes de fonte secundária): a redução na faixa é um VALOR FIXO em
// reais função da renda, R = A − B × renda, NÃO uma fração do imposto.
const REDUTOR_ANUAL_A = 8429.73;
const REDUTOR_ANUAL_B = 0.095575;
const REDUTOR_FAIXA_MIN = 60_000; // 12 × R$ 5.000
const REDUTOR_FAIXA_MAX = 88_200; // 12 × R$ 7.350

/**
 * Redutor anual da Lei 15.270/2025 (a partir de 2026): zera o imposto até
 * R$ 60.000/ano de renda tributável e decai até R$ 88.200/ano.
 *
 * Correção da auditoria (H1): antes era `impostoBruto × fração` (fração do
 * imposto — quadrático na renda); agora é a redução em reais definida pela lei
 * (afim na renda), limitada a 0 ≤ redutor ≤ imposto_bruto.
 */
export function computeRedutorAnual(
  year: number,
  rendaAnualBruta: number,
  impostoBruto: number,
): number {
  if (year < 2026) return 0;
  if (rendaAnualBruta <= REDUTOR_FAIXA_MIN) return impostoBruto; // zera o imposto
  if (rendaAnualBruta >= REDUTOR_FAIXA_MAX) return 0;
  const reducao = REDUTOR_ANUAL_A - REDUTOR_ANUAL_B * rendaAnualBruta;
  return Math.max(0, Math.min(reducao, impostoBruto));
}

export function assembleImposto(input: ImpostoMathInput): ImpostoMathResult {
  const { year, baseTributavelBruta, inssAndOfficial, numDependents, deductions, taxTable } = input;
  const { educacao, eduPeople, saude, pgblPrev, pensao, outros, donations, inssFromPay } = deductions;

  const dependentsDeduction = numDependents * taxTable.dependentDeduction;

  // ---- Modelo COMPLETO ----
  const educacaoLimit = Math.max(1, eduPeople) * taxTable.educationLimitPerPerson;
  const educacaoLimitApplied = Math.min(educacao, educacaoLimit);

  const pgblLimit = baseTributavelBruta * 0.12;
  const pgblLimitApplied = Math.min(pgblPrev, pgblLimit);

  const totalDeducoes =
    inssAndOfficial +
    inssFromPay +
    dependentsDeduction +
    educacaoLimitApplied +
    saude +
    pgblLimitApplied +
    pensao +
    outros;

  const baseCompleto = Math.max(0, baseTributavelBruta - totalDeducoes);
  const grossTaxCompletoBefore = calcProgressiveTax(baseCompleto, taxTable.brackets);
  const donationLimit = grossTaxCompletoBefore * 0.06;
  const donationsApplied = Math.min(donations, donationLimit);
  const grossTaxCompletoAfterDon = Math.max(0, grossTaxCompletoBefore - donationsApplied);
  const redutorCompleto = computeRedutorAnual(year, baseTributavelBruta, grossTaxCompletoAfterDon);
  const grossTaxCompleto = Math.max(0, grossTaxCompletoAfterDon - redutorCompleto);

  // ---- Modelo SIMPLES ----
  const descontoPadrao = Math.min(baseTributavelBruta * taxTable.simplesPct, taxTable.simplesLimit);
  const baseSimples = Math.max(0, baseTributavelBruta - descontoPadrao);
  const grossTaxSimplesBefore = calcProgressiveTax(baseSimples, taxTable.brackets);
  const redutorSimples = computeRedutorAnual(year, baseTributavelBruta, grossTaxSimplesBefore);
  const grossTaxSimples = Math.max(0, grossTaxSimplesBefore - redutorSimples);

  const netDueCompleto = grossTaxCompleto - input.irrfRetained - input.carneLeaoCredit;
  const netDueSimples = grossTaxSimples - input.irrfRetained - input.carneLeaoCredit;

  const recommendation: "simples" | "completo" =
    netDueCompleto <= netDueSimples ? "completo" : "simples";
  const savings = Math.abs(netDueCompleto - netDueSimples);

  return {
    dependentsDeduction,
    completo: {
      educacaoLimitApplied,
      pgblLimitApplied,
      totalDeducoes,
      donationsLimit: donationLimit,
      donationsApplied,
      base: baseCompleto,
      grossTax: grossTaxCompleto,
      netDue: netDueCompleto,
    },
    simples: {
      descontoPadrao,
      base: baseSimples,
      grossTax: grossTaxSimples,
      netDue: netDueSimples,
    },
    recommendation,
    savings,
  };
}
