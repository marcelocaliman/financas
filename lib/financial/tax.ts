/**
 * IR regressivo em renda fixa (vigência 2026).
 *  até 180 dias  → 22,5%
 *  até 360 dias  → 20,0%
 *  até 720 dias  → 17,5%
 *  acima         → 15,0%
 */

export type TaxRegime = "regressive" | "exempt";

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
