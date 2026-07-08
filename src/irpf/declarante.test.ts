import { describe, it, expect } from "vitest";
import { belongsTo, applyShare, itemsForDeclarante, incomesForDeclarante } from "./declarante";
import { SHARED_OWNER, type TaxItem } from "@/domain/irpf";
import type { Income } from "@/domain/types";

const item = (over: Partial<TaxItem> = {}): TaxItem => ({
  id: "i", baseYear: 2025, kind: "asset", group: "03", code: "01",
  discriminacao: "x", currency: "BRL", valorAnoBase: 1000, fields: {}, ...over,
});
const inc = (over: Partial<Income> = {}): Income => ({
  id: "n", month: "2025-03", categoryId: "salario", name: "", currency: "BRL", amount: 100, ...over,
});
const A = "marcelo", B = "aline";

describe("belongsTo", () => {
  it("comum entra em TODAS as declarações", () => {
    expect(belongsTo(item({ ownerId: SHARED_OWNER }), A, A)).toBe(true);
    expect(belongsTo(item({ ownerId: SHARED_OWNER }), B, A)).toBe(true);
  });
  it("sem dono cai no primário", () => {
    expect(belongsTo(item({ ownerId: undefined }), A, A)).toBe(true);  // A é primário
    expect(belongsTo(item({ ownerId: undefined }), B, A)).toBe(false); // não é do B
  });
  it("com dono, só a declaração daquela pessoa", () => {
    expect(belongsTo(item({ ownerId: B }), B, A)).toBe(true);
    expect(belongsTo(item({ ownerId: B }), A, A)).toBe(false);
  });
});

describe("applyShare", () => {
  it("comum 50% divide todas as colunas", () => {
    const out = applyShare(item({ ownerId: SHARED_OWNER, valorAnoBase: 320000, valorAnoAnterior: 300000 }));
    expect(out.valorAnoBase).toBe(160000);
    expect(out.valorAnoAnterior).toBe(150000);
  });
  it("comum com sharePct customizado", () => {
    const out = applyShare(item({ ownerId: SHARED_OWNER, valorAnoBase: 100, sharePct: 30 }));
    expect(out.valorAnoBase).toBe(30);
  });
  it("bem no exterior divide o BRL também", () => {
    const out = applyShare(item({ ownerId: SHARED_OWNER, currency: "USD", valorAnoBase: 1000, valorBrlAnoBase: 5000, valorBrlAnoAnterior: 4000 }));
    expect(out.valorBrlAnoBase).toBe(2500);
    expect(out.valorBrlAnoAnterior).toBe(2000);
  });
  it("não-comum passa inalterado", () => {
    const it = item({ ownerId: A, valorAnoBase: 1000 });
    expect(applyShare(it)).toBe(it);
  });
});

describe("itemsForDeclarante", () => {
  it("filtra por dono e já divide os comuns", () => {
    const items = [
      item({ id: "meu", ownerId: A, valorAnoBase: 1000 }),
      item({ id: "dela", ownerId: B, valorAnoBase: 2000 }),
      item({ id: "comum", ownerId: SHARED_OWNER, valorAnoBase: 4000 }),
      item({ id: "semdono", ownerId: undefined, valorAnoBase: 500 }),
    ];
    const meus = itemsForDeclarante(items, A, A); // A é primário
    expect(meus.map((i) => i.id).sort()).toEqual(["comum", "meu", "semdono"]);
    expect(meus.find((i) => i.id === "comum")!.valorAnoBase).toBe(2000); // 50%
    const dela = itemsForDeclarante(items, B, A);
    expect(dela.map((i) => i.id).sort()).toEqual(["comum", "dela"]); // sem "semdono" (é do primário A)
    expect(dela.find((i) => i.id === "comum")!.valorAnoBase).toBe(2000);
  });
});

describe("incomesForDeclarante", () => {
  it("renda por pessoa; sem pessoa cai no primário", () => {
    const incomes = [inc({ id: "a", personId: A }), inc({ id: "b", personId: B }), inc({ id: "casa", personId: undefined })];
    expect(incomesForDeclarante(incomes, A, A).map((i) => i.id).sort()).toEqual(["a", "casa"]);
    expect(incomesForDeclarante(incomes, B, A).map((i) => i.id)).toEqual(["b"]);
  });
});
