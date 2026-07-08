import { describe, it, expect } from "vitest";
import { itemIssues, countPending, diffPatrimonio } from "./validate";
import { buildRollForward } from "@/finance/irpf-seed";
import type { TaxItem } from "@/domain/irpf";
import type { Asset, Liability } from "@/domain/types";

const item = (over: Partial<TaxItem> = {}): TaxItem => ({
  id: "i1", baseYear: 2025, kind: "asset", group: "04", code: "02",
  discriminacao: "CDB no banco X, CNPJ 00.000.000/0001-00", currency: "BRL", valorAnoBase: 1000, fields: {}, ...over,
});
const asset = (id: string): Asset => ({ id, name: id, classId: "acoes", currency: "BRL", amount: 1 });
const liab = (id: string): Liability => ({ id, name: id, typeId: "emprestimo-pessoal", currency: "BRL", amount: 1 });

describe("itemIssues", () => {
  it("item completo não tem pendência", () => {
    expect(itemIssues(item())).toEqual([]);
  });
  it("sem código, sem valor e discriminação incompleta", () => {
    const iss = itemIssues(item({ group: "", code: "", valorAnoBase: 0, discriminacao: "Ação [preencher: CNPJ]" }));
    expect(iss).toContain("no-code");
    expect(iss).toContain("no-value");
    expect(iss).toContain("incomplete");
  });
  it("exterior sem BRL informado → pendência", () => {
    expect(itemIssues(item({ currency: "USD" }))).toContain("foreign-no-brl");
    expect(itemIssues(item({ currency: "USD", valorBrlAnoBase: 5000 }))).not.toContain("foreign-no-brl");
  });
  it("countPending conta itens com ao menos 1 pendência", () => {
    expect(countPending([item(), item({ code: "" })])).toBe(1);
  });
  it("bem VENDIDO (base 0) não é pendência de valor nem de BRL do exterior", () => {
    expect(itemIssues(item({ disposed: true, valorAnoBase: 0 }))).not.toContain("no-value");
    expect(itemIssues(item({ disposed: true, valorAnoBase: 0, currency: "USD" }))).not.toContain("foreign-no-brl");
  });
});

describe("diffPatrimonio", () => {
  it("acha novos (sem linha) e órfãos (bem sumiu)", () => {
    const items = [item({ sourceId: "a1", source: "seed-asset" }), item({ id: "i2", sourceId: "aX", source: "seed-asset" })];
    const d = diffPatrimonio(items, [asset("a1"), asset("a2")], [liab("l1")]);
    expect(d.newAssets.map((a) => a.id)).toEqual(["a2"]);      // a1 já tem linha; a2 é novo
    expect(d.newLiabilities.map((l) => l.id)).toEqual(["l1"]); // l1 sem linha
    expect(d.orphans.map((o) => o.id)).toEqual(["i2"]);        // aX não está mais no patrimônio
  });
  it("item manual nunca vira órfão", () => {
    const d = diffPatrimonio([item({ id: "m", source: "manual" })], [], []);
    expect(d.orphans).toEqual([]);
  });
  it("bem VENDIDO não vira órfão (a venda é intencional, já tratada)", () => {
    const d = diffPatrimonio([item({ id: "v", sourceId: "aX", source: "seed-asset", disposed: true })], [], []);
    expect(d.orphans).toEqual([]);
  });
});

describe("buildRollForward", () => {
  it("desce o valor pro ano anterior, herda p/ revisar e regera o id determinístico", () => {
    const prev = [item({ sourceId: "a1", source: "seed-asset", valorAnoBase: 1000, valorBrlAnoBase: undefined })];
    const [n] = buildRollForward(prev, 2026);
    expect(n.baseYear).toBe(2026);
    expect(n.valorAnoAnterior).toBe(1000);
    expect(n.valorAnoBase).toBe(1000);
    expect(n.needsReview).toBe(true);
    expect(n.id).toBe("irpf-2026-a-a1");
    expect(n.code).toBe("02"); // preserva o código/discriminação
  });
});
