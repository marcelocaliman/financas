import { describe, it, expect } from "vitest";
import { debtPlan, monthlyPayment, amortizationBalances } from "./debt";

describe("monthlyPayment", () => {
  it("sem juros: saldo dividido pelas parcelas", () => {
    expect(monthlyPayment(1200, 0, 12)).toBe(100);
  });
  it("com juros, parcela > saldo/n (há custo de juros)", () => {
    const pmt = monthlyPayment(1000, 0.01, 12);
    expect(pmt).toBeGreaterThan(1000 / 12);
    expect(pmt).toBeCloseTo(88.85, 1); // PMT(1%, 12, 1000)
  });
  it("zero parcelas → 0", () => {
    expect(monthlyPayment(1000, 0.01, 0)).toBe(0);
  });
});

describe("debtPlan", () => {
  it("sem juros: total pago = saldo, juros 0", () => {
    const p = debtPlan(1200, 0, 12)!;
    expect(p.monthly).toBe(100);
    expect(p.totalPaid).toBeCloseTo(1200, 6);
    expect(p.totalInterest).toBeCloseTo(0, 6);
  });
  it("com juros: juros = total pago − saldo > 0", () => {
    const p = debtPlan(10000, 12, 24)!;
    expect(p.months).toBe(24);
    expect(p.totalInterest).toBeGreaterThan(0);
    expect(p.totalPaid).toBeCloseTo(p.monthly * 24, 6);
  });
  it("saldo ou parcelas inválidos → null", () => {
    expect(debtPlan(0, 10, 12)).toBeNull();
    expect(debtPlan(1000, 10, 0)).toBeNull();
    expect(debtPlan(-5, 10, 12)).toBeNull();
  });
  it("arredonda parcelas fracionárias", () => {
    expect(debtPlan(1000, 0, 11.6)!.months).toBe(12);
  });
});

describe("amortizationBalances", () => {
  it("começa no saldo e termina ~0; tamanho = parcelas + 1", () => {
    const b = amortizationBalances(1200, 0, 12);
    expect(b).toHaveLength(13);
    expect(b[0]).toBe(1200);
    expect(b[12]).toBeCloseTo(0, 6);
  });
  it("com juros, amortiza totalmente (saldo final ~0) e é decrescente", () => {
    const b = amortizationBalances(10000, 12, 24);
    expect(b[0]).toBe(10000);
    expect(b[24]).toBeCloseTo(0, 4);
    for (let k = 1; k < b.length; k++) expect(b[k]).toBeLessThanOrEqual(b[k - 1] + 1e-9);
  });
  it("a soma das amortizações iguala o saldo (consistência Price)", () => {
    const principal = 10000;
    const b = amortizationBalances(principal, 12, 24);
    const reduzido = principal - b[b.length - 1];
    expect(reduzido).toBeCloseTo(principal, 4);
  });
  it("sem plano válido devolve [saldo]", () => {
    expect(amortizationBalances(500, 10, 0)).toEqual([500]);
  });
});
