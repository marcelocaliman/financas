import { describe, it, expect } from "vitest";

/**
 * Testes da semântica de saque proporcional (TD-style) implementada em
 * services/redemptions.actions.ts. Reproduz a aritmética pura aqui pra
 * validar invariantes sem necessidade de DB.
 *
 * Invariantes:
 *   - ratio = amount / current_balance
 *   - new_balance = current_balance − amount
 *   - new_initial = initial × (1 − ratio)
 *   - rentabilidade % é PRESERVADA após o saque (ganho/custo igual)
 *   - fromYield = amount × (accumulated/current_balance)
 *   - principalReduction = amount × (initial/current_balance)
 *   - exceededYield = amount > accumulated
 */

function proportionalWithdraw(args: {
  initial: number;
  currentBalance: number;
  amount: number;
}) {
  const { initial, currentBalance, amount } = args;
  const ratio = amount / currentBalance;
  const newBalance = currentBalance - amount;
  const newInitial = initial * (1 - ratio);
  const accumulated = currentBalance - initial;
  const fromYield = (accumulated / currentBalance) * amount;
  const principalReduction = (initial / currentBalance) * amount;
  const exceededYield = amount > accumulated;
  return { newBalance, newInitial, fromYield, principalReduction, exceededYield };
}

describe("Saque RF proporcional (TD-style)", () => {
  it("saque pequeno (10k de 250k, com 50k de yield): rentabilidade % preservada", () => {
    // Antes: 250k balance, 200k initial, 50k yield (25%)
    const { newBalance, newInitial, fromYield, principalReduction, exceededYield } =
      proportionalWithdraw({ initial: 200000, currentBalance: 250000, amount: 10000 });

    expect(newBalance).toBe(240000);
    expect(newInitial).toBeCloseTo(192000, 2); // 200000 × 0.96
    expect(fromYield).toBe(2000); // 10000 × (50000 / 250000) = 10000 × 0.2 = 2000
    expect(principalReduction).toBe(8000); // 10000 × (200000 / 250000) = 10000 × 0.8 = 8000
    expect(exceededYield).toBe(false);

    // Rentabilidade preservada
    const yieldPctAntes = 50000 / 200000; // 25%
    const yieldPctDepois = (newBalance - newInitial) / newInitial; // 48000 / 192000 = 25%
    expect(yieldPctDepois).toBeCloseTo(yieldPctAntes, 6);
  });

  it("saque grande (70k de 250k, com 50k yield): excede e marca exceeded", () => {
    const result = proportionalWithdraw({
      initial: 200000,
      currentBalance: 250000,
      amount: 70000,
    });
    expect(result.newBalance).toBe(180000);
    // 200000 × (1 - 70/250) = 200000 × 0.72 = 144000
    expect(result.newInitial).toBeCloseTo(144000, 2);
    // 70k × (50/250) = 70k × 0.2 = 14k
    expect(result.fromYield).toBeCloseTo(14000, 2);
    // 70k × (200/250) = 70k × 0.8 = 56k
    expect(result.principalReduction).toBeCloseTo(56000, 2);
    // 70k > 50k de yield
    expect(result.exceededYield).toBe(true);

    // Rentabilidade ainda preservada
    const yieldPctDepois = (result.newBalance - result.newInitial) / result.newInitial;
    expect(yieldPctDepois).toBeCloseTo(0.25, 6);
  });

  it("invariante: fromYield + principalReduction = amount", () => {
    const cases = [
      { initial: 100000, currentBalance: 120000, amount: 5000 },
      { initial: 250000, currentBalance: 280000, amount: 15000 },
      { initial: 500000, currentBalance: 600000, amount: 100000 },
    ];
    for (const c of cases) {
      const r = proportionalWithdraw(c);
      expect(r.fromYield + r.principalReduction).toBeCloseTo(c.amount, 4);
    }
  });

  it("saque integral (= balance): zera o ativo", () => {
    const r = proportionalWithdraw({ initial: 200000, currentBalance: 250000, amount: 250000 });
    expect(r.newBalance).toBe(0);
    expect(r.newInitial).toBe(0);
    expect(r.exceededYield).toBe(true);
  });
});
