import { describe, it, expect } from "vitest";
import { buildSeedTaxItems } from "./irpf-seed";
import type { Asset, Liability } from "@/domain/types";
import type { TaxItem } from "@/domain/irpf";

const asset = (id: string, over: Partial<Asset> = {}): Asset => ({
  id, name: `Ativo ${id}`, classId: "acoes", currency: "BRL", amount: 1000, ...over,
});
const liab = (id: string, over: Partial<Liability> = {}): Liability => ({
  id, name: `Dívida ${id}`, typeId: "emprestimo", currency: "BRL", amount: 500, ...over,
});

describe("buildSeedTaxItems (idempotente)", () => {
  it("cria 1 linha por ativo e passivo quando não há nada", () => {
    const out = buildSeedTaxItems(2025, [asset("a1"), asset("a2")], [liab("l1")], []);
    expect(out).toHaveLength(3);
    expect(out.filter((i) => i.kind === "asset")).toHaveLength(2);
    expect(out.filter((i) => i.kind === "debt")).toHaveLength(1);
    expect(out.every((i) => i.baseYear === 2025)).toBe(true);
  });

  it("carrega valor/moeda/país e o valorAnoBase = valor atual", () => {
    const [item] = buildSeedTaxItems(
      2025,
      [asset("a1", { amount: 4200, currency: "EUR", regionId: "exterior", institution: "Corretora X" })],
      [],
      [],
    );
    expect(item.valorAnoBase).toBe(4200);
    expect(item.currency).toBe("EUR");
    expect(item.country).toBe("exterior");
    expect(item.institution).toBe("Corretora X");
    expect(item.source).toBe("seed-asset");
    expect(item.sourceId).toBe("a1");
  });

  it("PULA quem já tem linha (por sourceId) — não duplica nem sobrescreve edição manual", () => {
    const existing: TaxItem[] = [
      { id: "x", baseYear: 2025, kind: "asset", group: "04", code: "01", discriminacao: "editado à mão", currency: "BRL", valorAnoBase: 999, fields: {}, source: "manual", sourceId: "a1" },
    ];
    const out = buildSeedTaxItems(2025, [asset("a1"), asset("a2")], [], existing);
    expect(out).toHaveLength(1);
    expect(out[0].sourceId).toBe("a2"); // só o que faltava
  });

  it("id é determinístico (mesmo ativo+ano → mesmo id)", () => {
    const a = asset("a1");
    const [x] = buildSeedTaxItems(2025, [a], [], []);
    const [y] = buildSeedTaxItems(2025, [a], [], []);
    expect(x.id).toBe(y.id);
    expect(x.id).toBe("irpf-2025-a-a1");
  });
});
