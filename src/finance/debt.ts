import { monthlyRate } from "./projection";

/**
 * Cronograma de dívidas — amortização (Tabela Price), módulo PURO e testável.
 *
 * Dada uma dívida (saldo, taxa % a.a., nº de parcelas restantes), estima a parcela mensal,
 * o total a pagar, os juros e o saldo devedor mês a mês. Taxa mensal = efetiva equivalente
 * à anual ((1+a)^(1/12)−1), coerente com a Projeção. É uma ESTIMATIVA (assume parcelas iguais).
 */
export interface DebtPlan {
  monthly: number; // parcela mensal estimada (moeda da dívida)
  months: number; // nº de parcelas
  totalPaid: number; // parcela × parcelas
  totalInterest: number; // total pago − saldo
}

/** Taxa mensal efetiva a partir da % a.a. (0 se a taxa for ≤ 0). */
function monthlyFromAnnualPct(annualRatePct: number): number {
  return annualRatePct > 0 ? monthlyRate(annualRatePct / 100) : 0;
}

/** Parcela (PMT) da Tabela Price. Sem juros → saldo ÷ parcelas. */
export function monthlyPayment(principal: number, monthlyI: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyI <= 0) return principal / months;
  return (principal * monthlyI) / (1 - Math.pow(1 + monthlyI, -months));
}

/** Plano da dívida. `null` se não dá pra amortizar (sem saldo ou sem parcelas). */
export function debtPlan(principal: number, annualRatePct: number, installments: number): DebtPlan | null {
  const months = Math.round(installments);
  if (!(principal > 0) || !(months > 0)) return null;
  const i = monthlyFromAnnualPct(annualRatePct);
  const monthly = monthlyPayment(principal, i, months);
  const totalPaid = monthly * months;
  return { monthly, months, totalPaid, totalInterest: Math.max(0, totalPaid - principal) };
}

/**
 * Saldo devedor mês a mês: índice 0 = saldo atual; índice `months` ≈ 0.
 * Sem plano válido devolve `[principal]` (ou `[0]`).
 */
export function amortizationBalances(principal: number, annualRatePct: number, installments: number): number[] {
  const months = Math.round(installments);
  if (!(principal > 0) || !(months > 0)) return [Math.max(0, principal)];
  const i = monthlyFromAnnualPct(annualRatePct);
  const monthly = monthlyPayment(principal, i, months);
  const out = [principal];
  let bal = principal;
  for (let k = 1; k <= months; k++) {
    const interest = bal * i;
    bal = Math.max(0, bal + interest - monthly);
    out.push(bal);
  }
  return out;
}
