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

describe("isQuoteRefreshDue", () => {
  // 2026-06-15 é uma segunda-feira; 2026-06-13 sábado; 2026-06-14 domingo.
  it("nunca buscado (bootstrap) sempre atualiza", () => {
    expect(isQuoteRefreshDue(null, brt(2026, 6, 13, 12, 0))).toBe(true); // até no sábado
  });

  it("fim de semana não atualiza", () => {
    const fri = brt(2026, 6, 12, 18, 0); // sexta após o fechamento
    expect(isQuoteRefreshDue(fri, brt(2026, 6, 13, 11, 0))).toBe(false); // sábado
    expect(isQuoteRefreshDue(fri, brt(2026, 6, 14, 15, 0))).toBe(false); // domingo
  });

  it("dia de pregão, antes da 1ª janela (10:30): não atualiza", () => {
    const prev = brt(2026, 6, 12, 18, 0);
    expect(isQuoteRefreshDue(prev, brt(2026, 6, 15, 9, 0))).toBe(false);
  });

  it("atualiza uma vez por janela que passou (cap 4/dia)", () => {
    let last = brt(2026, 6, 12, 18, 0); // última = sexta
    // 10:31 → passou a janela das 10:30 → atualiza
    expect(isQuoteRefreshDue(last, brt(2026, 6, 15, 10, 31))).toBe(true);
    last = brt(2026, 6, 15, 10, 31); // marcou
    // 11:00 → ainda na mesma janela → NÃO atualiza
    expect(isQuoteRefreshDue(last, brt(2026, 6, 15, 11, 0))).toBe(false);
    // 12:31 → janela das 12:30 → atualiza
    expect(isQuoteRefreshDue(last, brt(2026, 6, 15, 12, 31))).toBe(true);
    last = brt(2026, 6, 15, 17, 35); // pegou o fechamento
    // 18:00 → sem mais janelas → NÃO atualiza
    expect(isQuoteRefreshDue(last, brt(2026, 6, 15, 18, 0))).toBe(false);
  });

  it("abrindo no meio do dia, faz só UMA atualização (não uma por janela perdida)", () => {
    const prev = brt(2026, 6, 12, 18, 0);
    // 13:00 (passaram 10:30 e 12:30): due=true (uma busca cobre a última janela)
    expect(isQuoteRefreshDue(prev, brt(2026, 6, 15, 13, 0))).toBe(true);
    const after = brt(2026, 6, 15, 13, 0);
    // mesma sessão, 13:30: já cobriu a janela das 12:30 → não busca de novo até 14:30
    expect(isQuoteRefreshDue(after, brt(2026, 6, 15, 13, 30))).toBe(false);
    expect(isQuoteRefreshDue(after, brt(2026, 6, 15, 14, 31))).toBe(true);
  });
});
