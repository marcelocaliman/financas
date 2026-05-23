/**
 * IR regressivo em renda fixa (vigência 2026).
 *  até 180 dias  → 22,5%
 *  até 360 dias  → 20,0%
 *  até 720 dias  → 17,5%
 *  acima         → 15,0%
 */

export type TaxRegime = "regressive" | "exempt";

export const REGRESSIVE_BRACKETS = [
  { maxDays: 180, rate: 0.225, label: "22,5%" },
  { maxDays: 360, rate: 0.2, label: "20%" },
  { maxDays: 720, rate: 0.175, label: "17,5%" },
  { maxDays: Infinity, rate: 0.15, label: "15%" },
] as const;

export function regressiveIrRate(daysHeld: number): number {
  if (daysHeld <= 180) return 0.225;
  if (daysHeld <= 360) return 0.2;
  if (daysHeld <= 720) return 0.175;
  return 0.15;
}

export function applyIr(
  grossYield: number,
  daysHeld: number,
  regime: TaxRegime,
): { tax: number; net: number; rate: number } {
  if (regime === "exempt") return { tax: 0, net: grossYield, rate: 0 };
  const rate = regressiveIrRate(daysHeld);
  const tax = grossYield * rate;
  return { tax, net: grossYield - tax, rate };
}

export function daysBetween(fromISO: string, toISO?: string): number {
  const from = new Date(fromISO + (fromISO.length === 10 ? "T00:00:00Z" : ""));
  const to = toISO
    ? new Date(toISO + (toISO.length === 10 ? "T00:00:00Z" : ""))
    : new Date();
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

export type TaxEstimate = {
  rate: number;
  rateLabel: string;
  daysHeld: number;
  /** IR sobre o `grossYield` informado (R$) */
  taxAmount: number;
  netAmount: number;
  /**
   * Faixa imediatamente menor — null se já está na faixa mais baixa.
   * Útil pra mostrar: "esperando N dias o IR cai pra X%".
   */
  nextBracket: { daysToWait: number; newRate: number; newRateLabel: string } | null;
};

/**
 * Estimativa rica de IR + próxima faixa, pra UI educativa em /resgates.
 * Para regime 'exempt' retorna null (chamador renderiza "isento").
 */
export function estimateAssetTax(
  regime: TaxRegime,
  purchaseDateISO: string,
  grossYield: number,
  asOfISO?: string,
): TaxEstimate | null {
  if (regime === "exempt") return null;
  const daysHeld = daysBetween(purchaseDateISO, asOfISO);
  const idx = REGRESSIVE_BRACKETS.findIndex((b) => daysHeld <= b.maxDays);
  const current = REGRESSIVE_BRACKETS[idx];
  const next = REGRESSIVE_BRACKETS[idx + 1];
  const tax = Math.max(0, grossYield) * current.rate;
  return {
    rate: current.rate,
    rateLabel: current.label,
    daysHeld,
    taxAmount: Math.round(tax * 100) / 100,
    netAmount: Math.round((grossYield - tax) * 100) / 100,
    nextBracket: next
      ? {
          daysToWait: current.maxDays - daysHeld + 1,
          newRate: next.rate,
          newRateLabel: next.label,
        }
      : null,
  };
}
