import { describe, it, expect, afterEach, vi } from "vitest";
import { detectDefaultCurrency } from "./locale-default";

function setLangs(langs: string[]): void {
  vi.stubGlobal("navigator", { languages: langs, language: langs[0] });
}

describe("detectDefaultCurrency — moeda default por locale (não fixa em BRL)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pt-BR → BRL", () => {
    setLangs(["pt-BR"]);
    expect(detectDefaultCurrency()).toBe("BRL");
  });

  it("it-IT → EUR", () => {
    setLangs(["it-IT"]);
    expect(detectDefaultCurrency()).toBe("EUR");
  });

  it("tag curta 'it' → EUR (maximize preenche a região)", () => {
    setLangs(["it"]);
    expect(detectDefaultCurrency()).toBe("EUR");
  });

  it("pt-PT (português de Portugal) → EUR, não BRL", () => {
    setLangs(["pt-PT"]);
    expect(detectDefaultCurrency()).toBe("EUR");
  });

  it("en-US → USD", () => {
    setLangs(["en-US"]);
    expect(detectDefaultCurrency()).toBe("USD");
  });

  it("en-GB → GBP", () => {
    setLangs(["en-GB"]);
    expect(detectDefaultCurrency()).toBe("GBP");
  });

  it("primeira moeda suportada vence as seguintes", () => {
    setLangs(["es-ES", "en-US"]);
    expect(detectDefaultCurrency()).toBe("EUR");
  });

  it("região sem moeda suportada (ja-JP) → fallback BRL", () => {
    setLangs(["ja-JP"]);
    expect(detectDefaultCurrency()).toBe("BRL");
  });

  it("sem navigator (SSR/teste) → fallback BRL", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectDefaultCurrency()).toBe("BRL");
  });
});
