import { describe, it, expect } from "vitest";
import { computeNextOccurrences } from "@/services/recurrences";
import type { Tables } from "@/types/database";

/**
 * Cobre o FIX de `computeNextOccurrences` / `nextFrom` (services/recurrences.ts):
 * recorrência "weekly" com `day_of_week` definido ANCORA a 1ª ocorrência no
 * primeiro dia >= start_date cuja weekday == day_of_week, e itera de 7 em 7
 * (×interval) a partir daí. Antes ignorava day_of_week e caía sempre na
 * weekday do start_date.
 *
 * Convenção getUTCDay: 0=domingo … 6=sábado.
 *
 * Valores ESPERADOS derivados à mão (não copiados do output):
 *   - 2026-06-03 = quarta (getUTCDay=3)
 *   - 2026-06-05 / 12 / 19 / 26, 2026-07-03 = sextas (getUTCDay=5)
 *   - 2026-06-10 / 17 = quartas
 *   - delta = (day_of_week - start.getUTCDay() + 7) % 7
 */

// nextFrom lê: start_date, frequency, interval_count, day_of_month, day_of_week.
// computeNextOccurrences também lê end_date. Montamos só esses campos.
type RuleInput = Pick<
  Tables<"recurring_rules">,
  | "start_date"
  | "frequency"
  | "interval_count"
  | "day_of_month"
  | "day_of_week"
  | "end_date"
>;

function makeRule(over: Partial<RuleInput>): RuleInput {
  return {
    start_date: "2026-06-03", // quarta
    frequency: "weekly",
    interval_count: 1,
    day_of_month: null,
    day_of_week: null,
    end_date: null,
    ...over,
  } as unknown as RuleInput;
}

describe("computeNextOccurrences - weekly com day_of_week (FIX da âncora)", () => {
  it("(a) weekly interval 1, start quarta, day_of_week=5 (sexta) -> ancora na 1ª sexta >= start", () => {
    // start 2026-06-03 (quarta=3), day_of_week=5 (sexta).
    // delta = (5 - 3 + 7) % 7 = 2 -> effStart = 2026-06-05 (sexta).
    // from 2026-06-01 <= effStart -> 1ª = 06-05; depois +7, +7.
    const rule = makeRule({ day_of_week: 5, interval_count: 1 });
    const out = computeNextOccurrences(rule, "2026-06-01", 3);
    expect(out).toEqual(["2026-06-05", "2026-06-12", "2026-06-19"]);
  });

  it("(a') confirma que NÃO caiu nas quartas do start", () => {
    const rule = makeRule({ day_of_week: 5, interval_count: 1 });
    const out = computeNextOccurrences(rule, "2026-06-01", 3);
    // quarta seria 06-03 / 06-10 / 06-17 — não deve aparecer
    expect(out).not.toContain("2026-06-03");
    expect(out).not.toContain("2026-06-10");
    expect(out).not.toContain("2026-06-17");
    // toda data afirmada é sexta (getUTCDay === 5)
    for (const d of out) {
      expect(new Date(d + "T00:00:00Z").getUTCDay()).toBe(5);
    }
  });

  it("(b) day_of_week == weekday do start -> cai no próprio start e +7", () => {
    // start 2026-06-03 (quarta=3), day_of_week=3 -> delta=0 -> effStart=start.
    const rule = makeRule({ day_of_week: 3, interval_count: 1 });
    const out = computeNextOccurrences(rule, "2026-06-01", 3);
    expect(out).toEqual(["2026-06-03", "2026-06-10", "2026-06-17"]);
    for (const d of out) {
      expect(new Date(d + "T00:00:00Z").getUTCDay()).toBe(3);
    }
  });

  it("(c) day_of_week null -> comportamento antigo (weekday do start = quarta)", () => {
    // sem day_of_week, effStart = start = 2026-06-03 (quarta).
    const rule = makeRule({ day_of_week: null, interval_count: 1 });
    const out = computeNextOccurrences(rule, "2026-06-01", 3);
    expect(out).toEqual(["2026-06-03", "2026-06-10", "2026-06-17"]);
  });

  it("(d) interval 2 -> de 14 em 14 a partir da 1ª sexta", () => {
    // effStart = 06-05 (sexta). passo = 7*2 = 14.
    const rule = makeRule({ day_of_week: 5, interval_count: 2 });
    const out = computeNextOccurrences(rule, "2026-06-01", 3);
    expect(out).toEqual(["2026-06-05", "2026-06-19", "2026-07-03"]);
    for (const d of out) {
      expect(new Date(d + "T00:00:00Z").getUTCDay()).toBe(5);
    }
  });

  it("(sanidade) fromISO no meio da semana avança pro próximo passo correto", () => {
    // mesma regra de (a). fromISO = 2026-06-14 (domingo).
    // effStart=06-05. from > effStart.
    // diff = ceil((06-14 - 06-05)/dia) = 9; steps = ceil(9/7) = 2; +14 = 06-19.
    const rule = makeRule({ day_of_week: 5, interval_count: 1 });
    const out = computeNextOccurrences(rule, "2026-06-14", 3);
    expect(out).toEqual(["2026-06-19", "2026-06-26", "2026-07-03"]);
  });

  it("(sanidade) end_date corta as ocorrências (cursor > end -> break antes do push)", () => {
    // regra de (a) com end_date = 06-12. count=3.
    // 06-05 ok; 06-12 (== end, não >) entra; 06-19 (> end) -> break.
    const rule = makeRule({
      day_of_week: 5,
      interval_count: 1,
      end_date: "2026-06-12",
    });
    const out = computeNextOccurrences(rule, "2026-06-01", 3);
    expect(out).toEqual(["2026-06-05", "2026-06-12"]);
  });
});
