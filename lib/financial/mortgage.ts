/**
 * Cálculos de financiamento imobiliário (SAC + Price).
 *
 * Convenções brasileiras:
 *   - Taxa cotada como "anual nominal" (ex: 11,5% a.a.)
 *   - Conversão pra mensal usa COMPOSIÇÃO EFETIVA: (1 + a)^(1/12) − 1
 *     (alinha com calculadoras de bancos brasileiros pra habitacional)
 *   - SAC é o padrão da Caixa pra habitacional. Price é mais comum em
 *     financiamentos pessoais e algumas linhas de bancos privados.
 *
 * Pure / sem dependência. Pode rodar tanto no client quanto no server.
 */

export type LoanSystem = "sac" | "price";

export type FinancingInputs = {
  /** Preço total do imóvel (R$) */
  propertyPrice: number;
  /** Fração da entrada (0..1) */
  downPct: number;
  /** Fração dos custos de cartório/ITBI (0..1) */
  closingPct: number;
  /** Prazo do financiamento em meses */
  loanTermMonths: number;
  /** Taxa de juros anual (% a.a.) */
  loanAnnualRatePct: number;
  /** Sistema de amortização */
  loanSystem: LoanSystem;
};

export type FinancingBreakdown = {
  /** Valor da entrada (R$) */
  downPayment: number;
  /** Valor dos custos de cartório/ITBI (R$) */
  closingCosts: number;
  /** Total a poupar antes de fechar o negócio (R$) */
  totalToSave: number;
  /** Valor financiado pelo banco (R$) */
  loanAmount: number;
  /** Taxa mensal efetiva (decimal, ex: 0.0091) */
  monthlyRate: number;
  /** Primeira parcela mensal (R$). Em SAC é a maior; em Price é constante. */
  firstPayment: number;
  /** Última parcela mensal (R$). Em Price = firstPayment; em SAC é a menor. */
  lastPayment: number;
  /** Total de juros pagos ao longo do contrato (R$) */
  totalInterest: number;
  /** Custo total do imóvel (preço + juros) (R$) */
  totalCost: number;
};

/**
 * Converte taxa anual nominal em taxa mensal efetiva (composta).
 * Ex: 11.5% a.a. → 0.0091148 (~0.91% a.m.)
 */
export function annualToMonthlyRate(annualPct: number): number {
  if (annualPct <= 0) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/**
 * Calcula o breakdown completo do financiamento.
 *
 * SAC (Sistema de Amortização Constante):
 *   - amortização = L / n (constante)
 *   - juros_i = saldo_devedor_i × r (decresce)
 *   - parcela_i = amortização + juros_i (decresce)
 *   - parcela_1 (maior) = L/n + L×r
 *   - parcela_n (menor) = L/n + (L/n)×r
 *   - juros totais = soma_aritmética = r × L × (n+1)/2
 *
 * Price (Sistema Francês — parcela constante):
 *   - P = L × [r(1+r)^n] / [(1+r)^n − 1]
 *   - Custo total = P × n
 */
export function computeFinancing(inputs: FinancingInputs): FinancingBreakdown {
  const {
    propertyPrice,
    downPct,
    closingPct,
    loanTermMonths: n,
    loanAnnualRatePct,
    loanSystem,
  } = inputs;

  const downPayment = round2(propertyPrice * downPct);
  const closingCosts = round2(propertyPrice * closingPct);
  const totalToSave = round2(downPayment + closingCosts);
  const loanAmount = round2(propertyPrice - downPayment);
  const r = annualToMonthlyRate(loanAnnualRatePct);

  if (loanAmount <= 0 || n <= 0 || r < 0) {
    return {
      downPayment,
      closingCosts,
      totalToSave,
      loanAmount: Math.max(0, loanAmount),
      monthlyRate: r,
      firstPayment: 0,
      lastPayment: 0,
      totalInterest: 0,
      totalCost: propertyPrice,
    };
  }

  let firstPayment: number;
  let lastPayment: number;
  let totalInterest: number;

  if (loanSystem === "sac") {
    const amortization = loanAmount / n;
    firstPayment = amortization + loanAmount * r;
    // Saldo na última parcela: L - (n-1)×amortização = L/n
    const lastBalance = loanAmount - (n - 1) * amortization;
    lastPayment = amortization + lastBalance * r;
    // Juros totais (PA): r × L × (n+1)/2
    totalInterest = (r * loanAmount * (n + 1)) / 2;
  } else {
    // Price: parcela constante
    const factor = Math.pow(1 + r, n);
    const payment = r > 0 ? (loanAmount * r * factor) / (factor - 1) : loanAmount / n;
    firstPayment = payment;
    lastPayment = payment;
    totalInterest = payment * n - loanAmount;
  }

  return {
    downPayment,
    closingCosts,
    totalToSave,
    loanAmount,
    monthlyRate: r,
    firstPayment: round2(firstPayment),
    lastPayment: round2(lastPayment),
    totalInterest: round2(totalInterest),
    totalCost: round2(propertyPrice + totalInterest),
  };
}

/**
 * Avalia o quão saudável é o comprometimento da renda com a parcela.
 * Regra do mercado brasileiro: ≤ 30% é saudável; 30–40% apertado; > 40% alto risco.
 */
export type AffordabilityLevel = "ok" | "tight" | "high_risk";
export function classifyAffordability(
  payment: number,
  monthlyIncome: number,
): { ratio: number; level: AffordabilityLevel } {
  if (monthlyIncome <= 0) return { ratio: 0, level: "ok" };
  const ratio = payment / monthlyIncome;
  const level: AffordabilityLevel =
    ratio <= 0.30 ? "ok" : ratio <= 0.40 ? "tight" : "high_risk";
  return { ratio, level };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// Defaults regionais por moeda
// ============================================================================
// Valores típicos do mercado em cada região. Usados como sugestão inicial
// quando o usuário liga o toggle de financiamento — pode sobrescrever tudo.
//
// BRL (Brasil — habitacional Caixa SBPE):
//   - Entrada 20%, custos 5% (ITBI ~3% + escritura/cartório ~1.5%)
//   - 30 anos = 360m, ~11.5% a.a. (varia: TR+8-12%, IPCA+5-7%)
//   - SAC é o padrão da Caixa pra habitacional
//
// EUR (Itália — mutuo casa):
//   - Entrada 20%, custos ~10% (notaio ~2%, imposta registro 2-9% s/ valor
//     catastrale, imposta sostitutiva 0.25%, IVA 4-10% se nuova, perícia, etc)
//   - 20 anos = 240m, ~3.5% a.a. tasso fisso (médio Italia 2024)
//   - "Tasso fisso" é sempre amortização Francês (= Price), padrão absoluto
//
// USD (genérico — fixed-rate mortgage):
//   - Entrada 20%, custos ~4%
//   - 30 anos = 360m, ~7% a.a.
//   - Fixed-rate mortgage = Price
// ============================================================================

export type FinancingDefaults = {
  downPct: number;
  closingPct: number;
  loanTermMonths: number;
  loanAnnualRatePct: number;
  loanSystem: LoanSystem;
};

export function getFinancingDefaults(currency: "BRL" | "EUR" | "USD" | "GBP"): FinancingDefaults {
  if (currency === "EUR") {
    return {
      downPct: 0.20,
      closingPct: 0.10,
      loanTermMonths: 240,
      loanAnnualRatePct: 3.5,
      loanSystem: "price",
    };
  }
  if (currency === "USD") {
    return {
      downPct: 0.20,
      closingPct: 0.04,
      loanTermMonths: 360,
      loanAnnualRatePct: 7.0,
      loanSystem: "price",
    };
  }
  // BRL
  return {
    downPct: 0.20,
    closingPct: 0.05,
    loanTermMonths: 360,
    loanAnnualRatePct: 11.5,
    loanSystem: "sac",
  };
}
