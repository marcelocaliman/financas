import { describe, it, expect } from "vitest";
import { cleanDoc, signedMoneyToReceita } from "@/services/ir/dec-export";

describe("cleanDoc — CNPJ/CPF só dígitos (remove pontuação antes de cortar)", () => {
  it("CNPJ formatado (18 chars) vira 14 dígitos válidos", () => {
    expect(cleanDoc("12.345.678/0001-90", 14)).toBe("12345678000190");
  });
  it("CPF formatado vira 11 dígitos", () => {
    expect(cleanDoc("123.456.789-09", 14)).toBe("12345678909");
  });
  it("não trunca o meio do CNPJ (regressão do bug M13)", () => {
    // Antes, clean(...,14) cortava 'XX.XXX.XXX/000' — inválido.
    expect(cleanDoc("12.345.678/0001-90", 14)).not.toContain(".");
    expect(cleanDoc("12.345.678/0001-90", 14)).toHaveLength(14);
  });
  it("vazio/nulo → string vazia", () => {
    expect(cleanDoc(null)).toBe("");
    expect(cleanDoc(undefined)).toBe("");
    expect(cleanDoc("")).toBe("");
  });
});

describe("signedMoneyToReceita — preserva sinal de prejuízo (R73)", () => {
  it("lucro → centavos sem sinal", () => {
    expect(signedMoneyToReceita(150)).toBe("15000");
  });
  it("prejuízo → centavos com sinal negativo", () => {
    expect(signedMoneyToReceita(-150)).toBe("-15000");
  });
  it("zero → 0", () => {
    expect(signedMoneyToReceita(0)).toBe("0");
  });
});
