import { describe, it, expect } from "vitest";
import { parseQuotes, normalizeTickers, isQuoteRefreshDue } from "./brapi";

// Helper: timestamp UTC a partir do relógio de Brasília (BRT = UTC−3).
const brt = (y: number, mo: number, d: number, h: number, m: number) =>
  Date.UTC(y, mo - 1, d, h + 3, m);

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

describe("isQuoteRefreshDue (horária, em dia de pregão)", () => {
  // 2026-06-15 é uma segunda-feira; 2026-06-13 sábado; 2026-06-14 domingo.
  it("nunca buscado (bootstrap) sempre atualiza", () => {
    expect(isQuoteRefreshDue(null, brt(2026, 6, 13, 12, 0))).toBe(true); // até no sábado
  });

  it("fim de semana não atualiza", () => {
    const fri = brt(2026, 6, 12, 18, 0); // sexta após o fechamento
    expect(isQuoteRefreshDue(fri, brt(2026, 6, 13, 11, 0))).toBe(false); // sábado
    expect(isQuoteRefreshDue(fri, brt(2026, 6, 14, 15, 0))).toBe(false); // domingo
  });

  it("fora do pregão não atualiza (antes das 10:00 / depois das 18:15)", () => {
    const prev = brt(2026, 6, 12, 18, 0);
    expect(isQuoteRefreshDue(prev, brt(2026, 6, 15, 9, 30))).toBe(false); // antes da abertura
    expect(isQuoteRefreshDue(prev, brt(2026, 6, 15, 18, 30))).toBe(false); // depois do fechamento
  });

  it("durante o pregão, atualiza só depois de passar 1h da última", () => {
    const last = brt(2026, 6, 15, 11, 0); // marcou às 11:00
    expect(isQuoteRefreshDue(last, brt(2026, 6, 15, 11, 45))).toBe(false); // 45min → ainda não
    expect(isQuoteRefreshDue(last, brt(2026, 6, 15, 12, 1))).toBe(true); // 1h01 → atualiza
  });

  it("captura o fechamento (18:00–18:15) se passou 1h da última", () => {
    const last = brt(2026, 6, 15, 16, 50); // marcou às 16:50
    expect(isQuoteRefreshDue(last, brt(2026, 6, 15, 18, 5))).toBe(true); // 18:05, >1h → atualiza
  });
});
