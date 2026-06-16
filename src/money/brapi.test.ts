import { describe, it, expect } from "vitest";
import { parseQuotes, normalizeTickers, isQuotesStale, QUOTES_TTL_MS } from "./brapi";

describe("parseQuotes", () => {
  it("extrai preço/moeda por símbolo (maiúsculo) e ignora itens sem preço válido", () => {
    const q = parseQuotes({
      results: [
        { symbol: "petr4", regularMarketPrice: 38.5, currency: "BRL" },
        { symbol: "HGLG11", regularMarketPrice: 160.2 },
        { symbol: "ZZZZ3", regularMarketPrice: 0 }, // preço inválido → ignora
        { symbol: "NOPRICE" }, // sem preço → ignora
      ],
    });
    expect(q.PETR4).toEqual({ price: 38.5, currency: "BRL" });
    expect(q.HGLG11).toEqual({ price: 160.2, currency: "BRL" }); // default BRL
    expect(q.ZZZZ3).toBeUndefined();
    expect(q.NOPRICE).toBeUndefined();
  });

  it("não quebra com resposta vazia", () => {
    expect(parseQuotes({})).toEqual({});
  });
});

describe("normalizeTickers", () => {
  it("deduplica, tira espaços/vazios e sobe pra maiúsculo", () => {
    expect(normalizeTickers([" petr4 ", "PETR4", "", undefined, "hglg11"])).toEqual(["PETR4", "HGLG11"]);
  });
});

describe("isQuotesStale", () => {
  it("nunca buscado é velho; além do TTL é velho", () => {
    const now = 1_700_000_000_000;
    expect(isQuotesStale(null, now)).toBe(true);
    expect(isQuotesStale(now - 1000, now)).toBe(false);
    expect(isQuotesStale(now - QUOTES_TTL_MS - 1, now)).toBe(true);
  });
});
