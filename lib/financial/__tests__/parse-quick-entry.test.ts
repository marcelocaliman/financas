import { describe, it, expect } from "vitest";
import { parseQuickEntry, type QuickEntryCategory } from "../parse-quick-entry";

const CATS: QuickEntryCategory[] = [
  { id: "c-mercado", name: "Mercado", kind: "expense", rules: [{ match: "ifood" }] },
  { id: "c-salario", name: "Salário", kind: "income", rules: [{ match: "salário" }] },
  { id: "c-transporte", name: "Transporte", kind: "expense", rules: [{ match: "uber", weight: 0.8 }] },
];

describe("parseQuickEntry — valor", () => {
  it("inteiro simples antes da descrição", () => {
    const r = parseQuickEntry("30 mercado");
    expect(r.amount).toBe(30);
    expect(r.description).toBe("mercado");
    expect(r.kind).toBe("expense");
  });

  it("valor depois da descrição", () => {
    const r = parseQuickEntry("uber 27,90");
    expect(r.amount).toBeCloseTo(27.9, 2);
    expect(r.description).toBe("uber");
  });

  it("formato BR com milhar + decimal", () => {
    const r = parseQuickEntry("1.234,56 aluguel");
    expect(r.amount).toBeCloseTo(1234.56, 2);
    expect(r.description).toBe("aluguel");
  });

  it("ponto de milhar sem decimal", () => {
    const r = parseQuickEntry("1.500 conta de luz");
    expect(r.amount).toBe(1500);
    expect(r.description).toBe("conta luz");
  });

  it("decimal US com ponto", () => {
    expect(parseQuickEntry("12.50 cafe").amount).toBeCloseTo(12.5, 2);
  });

  it("vírgula decimal", () => {
    expect(parseQuickEntry("9,90 cafe").amount).toBeCloseTo(9.9, 2);
  });

  it("prefixo R$", () => {
    const r = parseQuickEntry("R$ 45,00 farmácia");
    expect(r.amount).toBe(45);
    expect(r.description).toBe("farmácia");
  });

  it("sufixo reais vira ruído", () => {
    const r = parseQuickEntry("50 reais padaria");
    expect(r.amount).toBe(50);
    expect(r.description).toBe("padaria");
  });

  it("sem número → amount null", () => {
    const r = parseQuickEntry("almoço");
    expect(r.amount).toBeNull();
    expect(r.description).toBe("almoço");
  });
});

describe("parseQuickEntry — kind", () => {
  it("prefixo + força receita", () => {
    const r = parseQuickEntry("+5000 salário");
    expect(r.kind).toBe("income");
    expect(r.amount).toBe(5000);
    expect(r.description).toBe("salário");
  });

  it("prefixo - força despesa", () => {
    expect(parseQuickEntry("-30 mercado").kind).toBe("expense");
  });

  it("default é despesa", () => {
    expect(parseQuickEntry("100 qualquer").kind).toBe("expense");
  });

  it("kindExplicit true só com sinal", () => {
    expect(parseQuickEntry("+50 x").kindExplicit).toBe(true);
    expect(parseQuickEntry("50 x").kindExplicit).toBe(false);
  });

  it("kindHint assume receita sem sinal", () => {
    const r = parseQuickEntry("5000 freela", [], "income");
    expect(r.kind).toBe("income");
    expect(r.kindExplicit).toBe(false);
  });

  it("sinal explícito vence o kindHint", () => {
    expect(parseQuickEntry("-30 x", [], "income").kind).toBe("expense");
  });

  it("kindHint income casa categoria de receita", () => {
    const r = parseQuickEntry("5000 salário", CATS, "income");
    expect(r.categoryId).toBe("c-salario");
  });
});

describe("parseQuickEntry — categoria", () => {
  it("casa por regra (ifood → Mercado)", () => {
    const r = parseQuickEntry("30 ifood", CATS);
    expect(r.categoryId).toBe("c-mercado");
    expect(r.categoryMatch).toBe("ifood");
  });

  it("casa por nome da categoria (mercado → Mercado)", () => {
    const r = parseQuickEntry("80 mercado da semana", CATS);
    expect(r.categoryId).toBe("c-mercado");
    expect(r.categoryMatch).toBe("Mercado");
  });

  it("regra com weight (uber → Transporte)", () => {
    const r = parseQuickEntry("uber 25", CATS);
    expect(r.categoryId).toBe("c-transporte");
  });

  it("receita só casa categoria de receita", () => {
    const r = parseQuickEntry("+5000 salário", CATS);
    expect(r.categoryId).toBe("c-salario");
  });

  it("sem match → categoryId null", () => {
    const r = parseQuickEntry("30 algo aleatório xyz", CATS);
    expect(r.categoryId).toBeNull();
  });

  it("sem categorias → null sem quebrar", () => {
    expect(parseQuickEntry("30 mercado").categoryId).toBeNull();
  });
});

describe("parseQuickEntry — bordas", () => {
  it("string vazia", () => {
    const r = parseQuickEntry("");
    expect(r.amount).toBeNull();
    expect(r.description).toBe("");
  });

  it("só o valor, sem descrição", () => {
    const r = parseQuickEntry("42");
    expect(r.amount).toBe(42);
    expect(r.description).toBe("");
  });

  it("zero não é valor válido", () => {
    expect(parseQuickEntry("0 nada").amount).toBeNull();
  });
});
