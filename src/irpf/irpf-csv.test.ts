import { describe, it, expect } from "vitest";
import { buildBensCSV, buildDividasCSV, changeFlag, brlValue, parseIrpfImport } from "./irpf-csv";
import type { TaxItem } from "@/domain/irpf";

const it_ = (over: Partial<TaxItem>): TaxItem => ({
  id: "i", baseYear: 2025, kind: "asset", group: "04", code: "02", discriminacao: "CDB",
  currency: "BRL", valorAnoBase: 1000, fields: {}, ...over,
});

describe("changeFlag / brlValue", () => {
  it("NOVO quando não tem ano anterior; ALTERADO quando o valor mudou", () => {
    expect(changeFlag(it_({ valorAnoAnterior: undefined }))).toBe("NOVO");
    expect(changeFlag(it_({ valorAnoAnterior: 900, valorAnoBase: 1000 }))).toBe("ALTERADO");
    expect(changeFlag(it_({ valorAnoAnterior: 1000, valorAnoBase: 1000 }))).toBe("");
    expect(changeFlag(it_({ disposed: true, valorAnoBase: 0, valorAnoAnterior: 900 }))).toBe("VENDIDO");
  });
  it("exterior usa o R$ manual (valorBrl*), não o valor na moeda", () => {
    const foreign = it_({ currency: "USD", valorAnoBase: 5000, valorBrlAnoBase: 26000 });
    expect(brlValue(foreign, "base")).toBe(26000);
    expect(brlValue(it_({ valorAnoBase: 1000 }), "base")).toBe(1000);
  });
});

describe("buildBensCSV", () => {
  it("gera cabeçalho + linha com código/nome oficiais, decimal vírgula e BOM", () => {
    const csv = buildBensCSV([it_({ group: "03", code: "01", discriminacao: "100 ações PETR4", valorAnoBase: 2500.5 })]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("ordem;novo_alterado;grupo;grupo_nome");
    expect(csv).toContain("03;Participações Societárias;01;Ações (inclusive as listadas em bolsa)");
    expect(csv).toContain("2500,50");
  });
  it("exterior traz moeda de origem + observação e NÃO inventa o R$", () => {
    const csv = buildBensCSV([it_({ currency: "EUR", valorAnoBase: 1000, group: "06", code: "01" })]);
    expect(csv).toContain("EUR;1000,00"); // moeda_origem;valor_moeda_origem
    expect(csv).toContain("Exterior");
    // sem R$ manual → as duas colunas de situação em BRL ficam VAZIAS (;;) antes da observação
    expect(csv).toContain(';;"Exterior');
  });
  it("bem VENDIDO: flag VENDIDO, situação do ano-base = 0 e observação de ganho de capital", () => {
    const csv = buildBensCSV([it_({ group: "01", code: "12", disposed: true, valorAnoBase: 0, valorAnoAnterior: 300000, discriminacao: "Apê — VENDIDO" })]);
    expect(csv).toContain("VENDIDO");
    expect(csv).toContain("300000,00;0,00"); // anterior = custo; ano-base = 0
    expect(csv).toContain("ganho de capital");
  });
});

describe("buildDividasCSV", () => {
  it("só dívidas, com o nome do código oficial", () => {
    const csv = buildDividasCSV([it_({ kind: "debt", group: "", code: "11", discriminacao: "Financiamento" })]);
    expect(csv).toContain("Estabelecimento bancário comercial");
    expect(csv).not.toContain("CDB");
  });
});

describe("parseIrpfImport", () => {
  it("importa linhas da planilha em itens; pula vazias; exterior guarda a moeda", () => {
    const csv = "﻿nome;grupo;codigo;cnpj;valor;moeda;pais\nAções PETR4;03;01;33.000.167/0001-01;20.000,00;BRL;\nApple;03;01;;5000,00;USD;eua\n;;;;;;\n";
    const items = parseIrpfImport(csv, 2025);
    expect(items).toHaveLength(2); // a linha vazia é ignorada
    expect(items[0].group).toBe("03");
    expect(items[0].valorAnoBase).toBe(20000); // "20.000,00" pt-BR
    expect(items[0].fields.cnpj).toBe("33.000.167/0001-01");
    expect(items[0].needsReview).toBeUndefined(); // valor informado ≠ "revisar"
    expect(items[1].currency).toBe("USD");
    expect(items[1].country).toBe("eua");
    expect(items.every((i) => i.baseYear === 2025 && i.source === "manual")).toBe(true);
  });
});
