import { describe, it, expect } from "vitest";
import { buildRateMap, convert, convertOrSame } from "@/lib/financial/currency";

/**
 * Testes da conversão de moeda — função pura sobre o RateMap.
 * Garante:
 *   - pares idênticos sempre devolvem o valor original
 *   - taxa direta multiplica
 *   - taxa inversa divide (quando só uma direção existe)
 *   - retorna null se não tem caminho (e convertOrSame devolve valor original)
 */

describe("buildRateMap", () => {
  it("inclui auto-pares = 1 pra todas as moedas suportadas", () => {
    const map = buildRateMap([]);
    expect(map["BRL→BRL"]).toBe(1);
    expect(map["USD→USD"]).toBe(1);
    expect(map["EUR→EUR"]).toBe(1);
  });

  it("popula com os rows fornecidos", () => {
    const map = buildRateMap([
      { base: "USD", quote: "BRL", rate: 5.5 },
      { base: "BRL", quote: "USD", rate: 0.18 },
    ]);
    expect(map["USD→BRL"]).toBe(5.5);
    expect(map["BRL→USD"]).toBe(0.18);
  });
});

describe("convert", () => {
  it("mesma moeda → devolve valor sem consultar mapa", () => {
    const map = buildRateMap([]);
    expect(convert(100, "BRL", "BRL", map)).toBe(100);
  });

  it("taxa direta — multiplica", () => {
    const map = buildRateMap([{ base: "USD", quote: "BRL", rate: 5.5 }]);
    expect(convert(10, "USD", "BRL", map)).toBeCloseTo(55, 2);
  });

  it("fallback pra taxa inversa — divide", () => {
    // Só tem USD→BRL = 5.5. Convertendo BRL→USD usa o inverso.
    const map = buildRateMap([{ base: "USD", quote: "BRL", rate: 5.5 }]);
    expect(convert(55, "BRL", "USD", map)).toBeCloseTo(10, 4);
  });

  it("preferência: direta > inversa", () => {
    // Se ambos existem com valores diferentes (intencional pra testar precedência),
    // usa direto, não recíproca.
    const map = buildRateMap([
      { base: "EUR", quote: "BRL", rate: 6 },
      { base: "BRL", quote: "EUR", rate: 0.18 }, // 1/6 = 0.1667; aqui propositadamente diferente
    ]);
    expect(convert(1, "EUR", "BRL", map)).toBeCloseTo(6, 6); // direta = 6
    expect(convert(1, "BRL", "EUR", map)).toBeCloseTo(0.18, 6); // direta = 0.18
  });

  it("sem taxa direta nem inversa → null", () => {
    const map = buildRateMap([{ base: "USD", quote: "BRL", rate: 5.5 }]);
    // EUR não tem nada
    expect(convert(100, "EUR", "BRL", map)).toBeNull();
    expect(convert(100, "BRL", "EUR", map)).toBeNull();
  });

  it("taxa zero ou negativa é ignorada (não retorna 0 espúrio)", () => {
    const map: Record<string, number> = {
      "USD→BRL": 0,
      "BRL→USD": 0,
    };
    map["BRL→BRL"] = 1;
    map["USD→USD"] = 1;
    map["EUR→EUR"] = 1;
    expect(convert(100, "USD", "BRL", map)).toBeNull();
  });
});

describe("convertOrSame", () => {
  it("se conversão funciona, devolve resultado", () => {
    const map = buildRateMap([{ base: "USD", quote: "BRL", rate: 5 }]);
    expect(convertOrSame(10, "USD", "BRL", map)).toBe(50);
  });

  it("se conversão falha, devolve valor original (não quebra UI)", () => {
    const map = buildRateMap([]);
    expect(convertOrSame(100, "USD", "BRL", map)).toBe(100);
  });
});
