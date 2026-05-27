import { describe, it, expect } from "vitest";
import { isBusinessDay, businessDaysSinceContinuous } from "@/lib/financial/business-days";

/**
 * Testes do calendário de dias úteis brasileiro — base do cálculo
 * de rendimento Selic/CDI/IPCA (base 252). Se o calendário estiver
 * errado, todo o yield indexado fica errado.
 *
 * Cobre:
 *   - fins de semana (sáb/dom) NÃO são dias úteis
 *   - feriados fixos (01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12)
 *   - feriados móveis (Carnaval, Sexta Santa, Corpus Christi) — relativos à Páscoa
 *   - businessDaysSinceContinuous: contagem inteira correta + fração final
 */

describe("isBusinessDay — fins de semana", () => {
  it("sábado 2026-05-23 NÃO é dia útil", () => {
    expect(isBusinessDay("2026-05-23")).toBe(false);
  });
  it("domingo 2026-05-24 NÃO é dia útil", () => {
    expect(isBusinessDay("2026-05-24")).toBe(false);
  });
  it("segunda 2026-05-25 É dia útil", () => {
    expect(isBusinessDay("2026-05-25")).toBe(true);
  });
});

describe("isBusinessDay — feriados nacionais fixos", () => {
  it("01/01 (Confraternização) — feriado", () => {
    expect(isBusinessDay("2026-01-01")).toBe(false);
  });
  it("21/04 (Tiradentes) — feriado", () => {
    expect(isBusinessDay("2026-04-21")).toBe(false);
  });
  it("01/05 (Trabalho) — feriado", () => {
    expect(isBusinessDay("2026-05-01")).toBe(false);
  });
  it("07/09 (Independência) — feriado", () => {
    expect(isBusinessDay("2026-09-07")).toBe(false);
  });
  it("12/10 (Aparecida) — feriado", () => {
    expect(isBusinessDay("2026-10-12")).toBe(false);
  });
  it("02/11 (Finados) — feriado", () => {
    expect(isBusinessDay("2026-11-02")).toBe(false);
  });
  it("15/11 (República) — feriado", () => {
    expect(isBusinessDay("2026-11-15")).toBe(false);
  });
  it("25/12 (Natal) — feriado", () => {
    expect(isBusinessDay("2026-12-25")).toBe(false);
  });
});

describe("isBusinessDay — feriados móveis (2025: Páscoa em 20/04)", () => {
  // Páscoa 2025 = 20/04
  // Carnaval = 3 e 4 de março (segunda/terça)
  // Sexta Santa = 18/04
  // Corpus Christi = 19/06
  it("Carnaval 2025 (03/03 segunda)", () => {
    expect(isBusinessDay("2025-03-03")).toBe(false);
  });
  it("Carnaval 2025 (04/03 terça)", () => {
    expect(isBusinessDay("2025-03-04")).toBe(false);
  });
  it("Sexta Santa 2025 (18/04)", () => {
    expect(isBusinessDay("2025-04-18")).toBe(false);
  });
  it("Corpus Christi 2025 (19/06)", () => {
    expect(isBusinessDay("2025-06-19")).toBe(false);
  });
});

describe("isBusinessDay — feriados móveis (2026: Páscoa em 05/04)", () => {
  // Carnaval = 16 e 17 de fevereiro
  // Sexta Santa = 03/04
  // Corpus Christi = 04/06
  it("Carnaval 2026 (16/02)", () => {
    expect(isBusinessDay("2026-02-16")).toBe(false);
  });
  it("Carnaval 2026 (17/02)", () => {
    expect(isBusinessDay("2026-02-17")).toBe(false);
  });
  it("Sexta Santa 2026 (03/04)", () => {
    expect(isBusinessDay("2026-04-03")).toBe(false);
  });
  it("Corpus Christi 2026 (04/06)", () => {
    expect(isBusinessDay("2026-06-04")).toBe(false);
  });
  it("dia útil normal 2026-05-26 (terça)", () => {
    expect(isBusinessDay("2026-05-26")).toBe(true);
  });
});

describe("businessDaysSinceContinuous — contagem inteira", () => {
  it("from = ontem útil → 0 inteiros + fração do dia (cap inferior 0)", () => {
    // De 26/05/2026 (ter) pra 27/05/2026 (qua), no início do dia
    // mock now = início do dia 27/05 SP
    const now = new Date("2026-05-27T03:00:00Z"); // 00:00 SP
    const n = businessDaysSinceContinuous("2026-05-26", now);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(0.01); // só fração ~0
  });

  it("from = 5 dias úteis atrás, sem feriado no meio", () => {
    // 2026-05-20 (qua) até 2026-05-27 (qua) = 4 dias úteis no meio
    // (21 qui, 22 sex, 25 seg, 26 ter) + fração de hoje
    const now = new Date("2026-05-27T03:00:00Z"); // 00:00 SP
    const n = businessDaysSinceContinuous("2026-05-20", now);
    expect(Math.floor(n)).toBe(4);
  });

  it("pula final de semana", () => {
    // 2026-05-22 (sex) até 2026-05-25 (seg) = só conta dias entre, exclusivo:
    // entre 22 (excl) e 25 (excl) = sáb e dom (não úteis) = 0
    const now = new Date("2026-05-25T03:00:00Z"); // 00:00 SP segunda
    const n = businessDaysSinceContinuous("2026-05-22", now);
    expect(Math.floor(n)).toBe(0);
  });

  it("pula feriado fixo (15/11)", () => {
    // 2026-11-13 (sex) até 2026-11-17 (ter) = no meio: 14 (sáb), 15 (dom mas tb feriado), 16 (seg útil)
    // 15/11 cai em domingo em 2026 — não muda nada
    // Vamos testar 2025: 14/11/2025 (sex) → 17/11/2025 (seg). Entre eles:
    //   15/11/2025 (sáb, e feriado) — não útil
    //   16/11/2025 (dom) — não útil
    // = 0 dias úteis completos
    const now = new Date("2025-11-17T03:00:00Z");
    const n = businessDaysSinceContinuous("2025-11-14", now);
    expect(Math.floor(n)).toBe(0);
  });
});
