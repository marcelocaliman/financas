import { describe, it, expect } from "vitest";
import {
  splitAssetByRegime,
  valueForFiler,
  type AssetForSplit,
  type FilerForSplit,
} from "@/lib/financial/ownership-split";

const PRIMARY: FilerForSplit = { id: "marcelo", is_primary: true };
const SECONDARY: FilerForSplit = { id: "maria", is_primary: false };
const FILERS = [PRIMARY, SECONDARY];

function asset(over: Partial<AssetForSplit> = {}): AssetForSplit {
  return {
    owner_filer_id: "marcelo",
    is_particular: false,
    ownership_percent: null,
    acquired_at: "2020-06-01",
    ...over,
  };
}

describe("splitAssetByRegime — casos sem casal", () => {
  it("sem filers → array vazio", () => {
    expect(splitAssetByRegime(asset(), [], "comunhao_parcial", null)).toEqual([]);
  });

  it("1 filer só → sempre 100% nele", () => {
    const r = splitAssetByRegime(asset(), [PRIMARY], "comunhao_parcial", "2018-01-01");
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });
});

describe("splitAssetByRegime — regime SOLTEIRO/SEPARAÇÃO", () => {
  it("solteiro → 100% no owner mesmo com 2 filers", () => {
    const r = splitAssetByRegime(asset(), FILERS, "solteiro", null);
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });

  it("separacao_total → 100% no owner (Maria também caso owner = Maria)", () => {
    const r = splitAssetByRegime(
      asset({ owner_filer_id: "maria" }),
      FILERS,
      "separacao_total",
      null,
    );
    expect(r).toEqual([{ filerId: "maria", percent: 100 }]);
  });

  it("separacao_obrigatoria → idem separação total", () => {
    const r = splitAssetByRegime(asset(), FILERS, "separacao_obrigatoria", null);
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });
});

describe("splitAssetByRegime — COMUNHÃO PARCIAL", () => {
  it("bem adquirido ANTES do casamento → 100% no owner (particular automático)", () => {
    const r = splitAssetByRegime(
      asset({ acquired_at: "2015-03-10" }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
    );
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });

  it("bem adquirido DEPOIS do casamento → 50/50 (split padrão)", () => {
    const r = splitAssetByRegime(
      asset({ acquired_at: "2023-06-01" }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
    );
    expect(r).toEqual([
      { filerId: "marcelo", percent: 50 },
      { filerId: "maria", percent: 50 },
    ]);
  });

  it("bem pós-casamento marcado como particular (herança/doação) → 100% no owner", () => {
    const r = splitAssetByRegime(
      asset({ acquired_at: "2023-06-01", is_particular: true }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
    );
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });
});

describe("splitAssetByRegime — COMUNHÃO UNIVERSAL", () => {
  it("tudo é 50/50 mesmo bens prévios", () => {
    const r = splitAssetByRegime(
      asset({ acquired_at: "2010-01-01" }),
      FILERS,
      "comunhao_universal",
      "2020-01-01",
    );
    expect(r).toEqual([
      { filerId: "marcelo", percent: 50 },
      { filerId: "maria", percent: 50 },
    ]);
  });

  it("herança marcada como particular → 100% no beneficiário", () => {
    const r = splitAssetByRegime(
      asset({ is_particular: true }),
      FILERS,
      "comunhao_universal",
      "2020-01-01",
    );
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });
});

describe("splitAssetByRegime — OVERRIDE ownership_percent", () => {
  it("conta conjunta 50/50 explícita", () => {
    const r = splitAssetByRegime(
      asset({ ownership_percent: 50 }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
    );
    expect(r).toEqual([
      { filerId: "marcelo", percent: 50 },
      { filerId: "maria", percent: 50 },
    ]);
  });

  it("override 100% no owner ignora split", () => {
    const r = splitAssetByRegime(
      asset({ ownership_percent: 100, acquired_at: "2023-06-01" }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
    );
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });

  it("override 70/30", () => {
    const r = splitAssetByRegime(
      asset({ ownership_percent: 70 }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
    );
    expect(r).toEqual([
      { filerId: "marcelo", percent: 70 },
      { filerId: "maria", percent: 30 },
    ]);
  });
});

describe("splitAssetByRegime — estratégia common_assets", () => {
  it("all_in_primary → bens comuns 100% no titular principal", () => {
    const r = splitAssetByRegime(
      asset({ acquired_at: "2023-06-01" }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
      "all_in_primary",
    );
    expect(r).toEqual([{ filerId: "marcelo", percent: 100 }]);
  });

  it("all_in_secondary → bens comuns 100% no cônjuge", () => {
    const r = splitAssetByRegime(
      asset({ acquired_at: "2023-06-01" }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
      "all_in_secondary",
    );
    expect(r).toEqual([{ filerId: "maria", percent: 100 }]);
  });
});

describe("valueForFiler", () => {
  it("filer A vê 50% de um bem 50/50", () => {
    const v = valueForFiler(
      100000,
      asset({ acquired_at: "2023-06-01" }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
      "marcelo",
    );
    expect(v).toBe(50000);
  });

  it("filer A vê 0 de bem particular do filer B", () => {
    const v = valueForFiler(
      100000,
      asset({ owner_filer_id: "maria", is_particular: true }),
      FILERS,
      "comunhao_parcial",
      "2020-01-01",
      "marcelo",
    );
    expect(v).toBe(0);
  });

  it("filer único vê 100%", () => {
    const v = valueForFiler(
      100000,
      asset(),
      [PRIMARY],
      "comunhao_parcial",
      null,
      "marcelo",
    );
    expect(v).toBe(100000);
  });
});
