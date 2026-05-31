import { describe, it, expect } from "vitest";
import { classifyIncomeTx, type IncomeAgg } from "@/services/ir/classify-income";
import {
  normalize,
  isSalaryCategory,
  isRentCategory,
  isDividendCategory,
  isGenericPassiveCategory,
} from "@/services/ir/income-aliases";

const base: IncomeAgg = { cat: "", hasPayer: false, isDistribuicaoLucros: false };

describe("normalize", () => {
  it("remove acentos e baixa caixa", () => {
    expect(normalize("Salário")).toBe("salario");
    expect(normalize("PRÓ-LABORE")).toBe("pro-labore");
    expect(normalize("  Locação  ")).toBe("locacao");
  });
});

describe("matchers de alias", () => {
  it("salário casa com variações de grafia", () => {
    for (const c of ["Salário", "salario", "Holerite", "Pró-labore", "honorários"]) {
      expect(isSalaryCategory(c)).toBe(true);
    }
  });
  it("aluguel casa com variações", () => {
    for (const c of ["Aluguel", "aluguéis", "Locação", "arrendamento", "Aluguel recebido"]) {
      expect(isRentCategory(c)).toBe(true);
    }
  });
  it("dividendos casa", () => {
    expect(isDividendCategory("Dividendos")).toBe(true);
    expect(isDividendCategory("JCP")).toBe(true);
  });
  it("'renda passiva' é genérica, não dividendo", () => {
    expect(isGenericPassiveCategory("Renda passiva")).toBe(true);
    expect(isDividendCategory("Renda passiva")).toBe(false);
  });
});

describe("classifyIncomeTx — o catch-all fail-loud", () => {
  it("NUNCA descarta: categoria desconhecida vira naoClassificado (crítico)", () => {
    const r = classifyIncomeTx({ ...base, cat: "categoria inventada xyz" });
    expect(r.bucket).toBe("naoClassificado");
    expect(r.confidence).toBe("baixa");
    expect(r.warning?.code).toBe("renda_nao_classificada");
    expect(r.warning?.severity).toBe("critico");
  });

  it("renda sem categoria E sem fonte → naoClassificado (não some)", () => {
    const r = classifyIncomeTx({ ...base, cat: "" });
    expect(r.bucket).toBe("naoClassificado");
  });
});

describe("classifyIncomeTx — aluguel deixa de ser isento", () => {
  it("aluguel → TRIBUTÁVEL com aviso de carnê-leão", () => {
    const r = classifyIncomeTx({ ...base, cat: "Aluguel recebido" });
    expect(r.bucket).toBe("tributavel");
    expect(r.warning?.code).toBe("aluguel_verificar_carne_leao");
  });

  it("'Renda passiva' genérica → naoClassificado (não mais isento)", () => {
    const r = classifyIncomeTx({ ...base, cat: "Renda passiva" });
    expect(r.bucket).toBe("naoClassificado");
    expect(r.warning?.code).toBe("renda_passiva_generica");
  });
});

describe("classifyIncomeTx — casos de alta confiança", () => {
  it("salário → tributável", () => {
    expect(classifyIncomeTx({ ...base, cat: "Salário" }).bucket).toBe("tributavel");
  });
  it("pró-labore → tributável", () => {
    expect(classifyIncomeTx({ ...base, cat: "Pró-labore" }).bucket).toBe("tributavel");
  });
  it("aposentadoria → tributável", () => {
    expect(classifyIncomeTx({ ...base, cat: "Aposentadoria" }).bucket).toBe("tributavel");
  });
  it("fonte pagadora cadastrada → tributável mesmo sem categoria", () => {
    expect(classifyIncomeTx({ ...base, cat: "", hasPayer: true }).bucket).toBe("tributavel");
  });
  it("distribuição de lucros PJ própria → isento cód. 09", () => {
    const r = classifyIncomeTx({ ...base, cat: "lucros", isDistribuicaoLucros: true });
    expect(r.bucket).toBe("isento");
    expect(r.receitaCode).toBe("09");
  });
  it("dividendos explícitos → isento cód. 09", () => {
    const r = classifyIncomeTx({ ...base, cat: "Dividendos" });
    expect(r.bucket).toBe("isento");
    expect(r.receitaCode).toBe("09");
  });
});
