import { describe, it, expect } from "vitest";
import { DEFAULT_TAXONOMY, CLASS, nameById } from "./taxonomy";
import { SEED } from "@/data/seed";

const tax = DEFAULT_TAXONOMY;
const classIds = new Set(tax.assetClasses.map((c) => c.id));
const subtypeById = new Map(tax.subtypes.map((s) => [s.id, s]));
const regionIds = new Set(tax.regions.map((r) => r.id));
const indexerIds = new Set(tax.indexers.map((i) => i.id));
const liabTypeIds = new Set(tax.liabilityTypes.map((l) => l.id));

describe("DEFAULT_TAXONOMY — integridade", () => {
  it("todo subtipo aponta pra uma classe existente", () => {
    for (const s of tax.subtypes) expect(classIds.has(s.classId)).toBe(true);
  });

  it("ids são únicos por lista", () => {
    const uniq = (xs: { id: string }[]) => new Set(xs.map((x) => x.id)).size === xs.length;
    expect(uniq(tax.assetClasses)).toBe(true);
    expect(uniq(tax.subtypes)).toBe(true);
    expect(uniq(tax.regions)).toBe(true);
    expect(uniq(tax.indexers)).toBe(true);
    expect(uniq(tax.liabilityTypes)).toBe(true);
  });

  it("cobre as 11 classes e os 4 indexadores do modelo", () => {
    expect(tax.assetClasses).toHaveLength(11);
    expect([...indexerIds]).toEqual(["prefixado", "cdi", "ipca", "selic"]);
  });
});

describe("SEED — referências resolvem na taxonomia", () => {
  it("ativos: classId/subtypeId/regionId/indexerId válidos e coerentes", () => {
    for (const a of SEED.assets) {
      expect(classIds.has(a.classId)).toBe(true);
      if (a.subtypeId) {
        const sub = subtypeById.get(a.subtypeId);
        expect(sub).toBeDefined();
        expect(sub?.classId).toBe(a.classId); // subtipo pertence à classe do ativo
      }
      if (a.regionId) expect(regionIds.has(a.regionId)).toBe(true);
      if (a.indexerId) {
        expect(indexerIds.has(a.indexerId)).toBe(true);
        expect(a.classId).toBe(CLASS.rendaFixa); // indexador só em Renda Fixa
      }
    }
  });

  it("passivos: typeId válido", () => {
    for (const l of SEED.liabilities) expect(liabTypeIds.has(l.typeId)).toBe(true);
  });
});

describe("nameById", () => {
  it("resolve por id e devolve '' pra ausente/indefinido", () => {
    expect(nameById(tax.assetClasses, CLASS.rendaFixa)).toBe("Renda Fixa");
    expect(nameById(tax.assetClasses, "inexistente")).toBe("");
    expect(nameById(tax.assetClasses, undefined)).toBe("");
  });
});
