import { describe, it, expect } from "vitest";
import { holdingsCost, explodeHoldings, isHoldingsClass, supersededByHoldings } from "./holdings";
import { buildSeedTaxItems } from "./irpf-seed";
import { irpfSeedMapper } from "@/irpf/mapper";
import type { Asset } from "@/domain/types";
import type { TaxItem } from "@/domain/irpf";

const taxItem = (over: Partial<TaxItem> = {}): TaxItem => ({
  id: "t", baseYear: 2025, kind: "asset", group: "03", code: "01", discriminacao: "",
  currency: "BRL", valorAnoBase: 1000, fields: {}, source: "seed-asset", ...over,
});

const asset = (over: Partial<Asset> = {}): Asset => ({ id: "a", name: "Ações", classId: "acoes", currency: "BRL", amount: 50000, ...over });

describe("holdingsCost", () => {
  it("soma qtd × preço médio", () => {
    expect(holdingsCost([{ quantity: 100, avgPrice: 20 }, { quantity: 50, avgPrice: 30 }])).toBe(100 * 20 + 50 * 30);
    expect(holdingsCost(undefined)).toBe(0);
  });
});

describe("isHoldingsClass", () => {
  it("ações/FIIs/cripto sim; caixa/imóvel não", () => {
    expect(isHoldingsClass("acoes")).toBe(true);
    expect(isHoldingsClass("fiis")).toBe(true);
    expect(isHoldingsClass("cripto")).toBe(true);
    expect(isHoldingsClass("caixa")).toBe(false);
    expect(isHoldingsClass("imoveis")).toBe(false);
  });
});

describe("explodeHoldings", () => {
  it("1 ativo com posições → 1 ativo por posição (id ativo::posição, cost = qtd×preço, sem holdings)", () => {
    const out = explodeHoldings([asset({ id: "acoes-br", holdings: [
      { id: "h1", ticker: "PETR4", quantity: 100, avgPrice: 20 },
      { id: "h2", ticker: "VALE3", quantity: 50, avgPrice: 60 },
    ] })]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("acoes-br::h1");
    expect(out[0].ticker).toBe("PETR4");
    expect(out[0].cost).toBe(2000);
    expect(out[0].holdings).toBeUndefined();
    expect(out[1].cost).toBe(3000);
  });
  it("ativo SEM posições passa inalterado", () => {
    const a = asset({ id: "x" });
    expect(explodeHoldings([a])).toEqual([a]);
  });
  it("carrega o disposedOn pras posições (venda do grupo todo)", () => {
    const out = explodeHoldings([asset({ id: "y", disposedOn: "2026-03-01", holdings: [{ id: "h", ticker: "PETR4", quantity: 10, avgPrice: 20 }] })]);
    expect(out[0].disposedOn).toBe("2026-03-01");
  });
});

describe("supersededByHoldings (limpeza de sync)", () => {
  const exploded = explodeHoldings([asset({ id: "acoes", holdings: [{ id: "h1", ticker: "PETR4", quantity: 100, avgPrice: 20 }] })]);
  it("marca o AGREGADO substituído por posições; NÃO marca ativo apagado de vez nem a posição válida", () => {
    const existing = [
      taxItem({ id: "agg", sourceId: "acoes" }),      // agregado antigo → limpar
      taxItem({ id: "pos", sourceId: "acoes::h1" }),  // posição válida → fica
      taxItem({ id: "gone", sourceId: "casa" }),      // ativo apagado (sem base válida) → órfão real, fica
    ];
    expect(supersededByHoldings(existing, exploded)).toEqual(["agg"]);
  });
  it("posição APAGADA (mas o ativo tem outras) é limpa", () => {
    const existing = [taxItem({ id: "old", sourceId: "acoes::h_removida" })];
    expect(supersededByHoldings(existing, exploded)).toEqual(["old"]);
  });
  it("não mexe em vendido/excluído/manual", () => {
    const existing = [
      taxItem({ id: "d", sourceId: "acoes", disposed: true }),
      taxItem({ id: "e", sourceId: "acoes", excluded: true }),
      taxItem({ id: "m", sourceId: "acoes", source: "manual" }),
    ];
    expect(supersededByHoldings(existing, exploded)).toEqual([]);
  });
});

describe("integra com o seed do IRPF", () => {
  it("cada posição vira um bem com o ticker e o custo (classe de custo)", () => {
    const exploded = explodeHoldings([asset({ id: "ab", classId: "acoes", holdings: [{ id: "h1", ticker: "PETR4", quantity: 100, avgPrice: 20 }] })]);
    const items = buildSeedTaxItems(2025, exploded, [], [], irpfSeedMapper);
    expect(items).toHaveLength(1);
    expect(items[0].fields.ticker).toBe("PETR4");
    expect(items[0].valorAnoBase).toBe(2000); // custo = 100×20
    expect(items[0].needsReview).toBe(false); // custo presente → não revisar
    expect(items[0].sourceId).toBe("ab::h1");
  });
});
