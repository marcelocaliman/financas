import { describe, it, expect } from "vitest";
import { buildBensCSV, buildDividasCSV, changeFlag, brlValue } from "./irpf-csv";
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
});

describe("buildDividasCSV", () => {
  it("só dívidas, com o nome do código oficial", () => {
    const csv = buildDividasCSV([it_({ kind: "debt", group: "", code: "11", discriminacao: "Financiamento" })]);
    expect(csv).toContain("Estabelecimento bancário comercial");
    expect(csv).not.toContain("CDB");
  });
});
