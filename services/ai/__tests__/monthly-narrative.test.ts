import { describe, it, expect } from "vitest";
import { buildHighlights } from "@/services/ai/monthly-narrative";
import { formatMoney } from "@/lib/utils/format";

/**
 * buildHighlights monta os cards de KPI do email de resumo mensal DE FORMA
 * DETERMINÍSTICA (dos números já calculados), não pela IA — pra não ficarem
 * sujeitos a alucinação. Estes testes travam: campo certo, sinal, tom e ordem.
 *
 * Fixtures usam os números reais de Maio/2026 (verificados contra o banco).
 */

const base = {
  monthLabel: "maio de 2026",
  income: 15115.83,
  expense: 12701.93,
  net: 2413.9,
  prevIncome: 14000,
  prevExpense: 3758.28,
  prevNet: 10241.72,
  topCategoriesCurrent: [],
  subscriptionsCount: 0,
  subscriptionsMonthly: 0,
};

describe("buildHighlights", () => {
  it("monta RECEITA/DESPESAS/SALDO + top 2 movers com valores, sinais e tons certos", () => {
    const hi = buildHighlights({
      ...base,
      topMovers: [
        { name: "Lazer", delta: 1866.92, previous: 0, current: 1866.92 },
        { name: "Mercado", delta: 1773.99, previous: 131.01, current: 1905 },
        // 3º mover é ignorado (só top 2 vão pro cabeçalho)
        { name: "Saúde", delta: 1522.14, previous: 112.61, current: 1634.75 },
      ],
    });

    expect(hi).toHaveLength(5);
    expect(hi.map((h) => h.label)).toEqual([
      "RECEITA",
      "DESPESAS",
      "SALDO DO MÊS",
      "LAZER",
      "MERCADO",
    ]);
    expect(hi.map((h) => h.tone)).toEqual([
      "positive", // receita
      "neutral", // despesa
      "positive", // saldo >= 0
      "negative", // gasto subiu
      "negative",
    ]);
    expect(hi[0].value).toBe(formatMoney(15115.83));
    expect(hi[1].value).toBe(formatMoney(12701.93));
    expect(hi[2].value).toBe(formatMoney(2413.9));
    expect(hi[3].value).toBe(`+${formatMoney(1866.92)}`);
    expect(hi[4].value).toBe(`+${formatMoney(1773.99)}`);
  });

  it("SALDO negativo → tom negative", () => {
    const hi = buildHighlights({ ...base, income: 1000, expense: 1500, net: -500, topMovers: [] });
    const saldo = hi.find((h) => h.label === "SALDO DO MÊS")!;
    expect(saldo.tone).toBe("negative");
    expect(saldo.value).toBe(formatMoney(-500));
  });

  it("mover de QUEDA → sinal − e tom positive (gasto caiu = bom)", () => {
    const hi = buildHighlights({
      ...base,
      topMovers: [{ name: "Mercado", delta: -300, previous: 800, current: 500 }],
    });
    const mover = hi.find((h) => h.label === "MERCADO")!;
    expect(mover.tone).toBe("positive");
    expect(mover.value).toBe(`−${formatMoney(300)}`);
  });

  it("sem movers → só os 3 KPIs fixos", () => {
    const hi = buildHighlights({ ...base, topMovers: [] });
    expect(hi).toHaveLength(3);
    expect(hi.map((h) => h.label)).toEqual(["RECEITA", "DESPESAS", "SALDO DO MÊS"]);
  });
});
