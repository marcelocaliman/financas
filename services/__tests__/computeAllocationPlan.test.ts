import { describe, it, expect } from "vitest";
import { computeAllocationPlan } from "@/services/goals";
import type { EnrichedGoal } from "@/services/goals";

/**
 * Testes para computeAllocationPlan (services/goals.ts).
 *
 * Convenções:
 *  - displayCurrency = "BRL" e rates = {} → convertOrSame é identidade
 *    (convert retorna `value` quando from === to), então NÃO há conversão.
 *  - Cada fixture só seta os campos lidos pela função:
 *    id, name, priority, allocation_mode, allocation_value, currency,
 *    target_amount, derivedCurrent, is_archived.
 *
 * Valores ESPERADOS derivados à mão (primeiros princípios), não copiados do output.
 */

const BRL = "BRL" as const;

function goal(partial: {
  id: string;
  name: string;
  priority: number;
  mode: EnrichedGoal["allocation_mode"];
  value: number | null;
  target: number;
  current: number;
  archived?: boolean;
}): EnrichedGoal {
  return {
    id: partial.id,
    name: partial.name,
    priority: partial.priority,
    allocation_mode: partial.mode,
    allocation_value: partial.value,
    currency: BRL,
    target_amount: partial.target,
    derivedCurrent: partial.current,
    is_archived: partial.archived ?? false,
  } as unknown as EnrichedGoal;
}

function byId(lines: ReturnType<typeof computeAllocationPlan>["lines"], id: string) {
  const l = lines.find((x) => x.goalId === id);
  if (!l) throw new Error(`linha não encontrada para id=${id}`);
  return l;
}

describe("computeAllocationPlan", () => {
  // ── Caso (a): duas metas percentage 50%/50% sobre sobra 1000 ──────────────
  // FIX: base = sobra mensal INTEIRA (1000), não o resto do waterfall.
  // Derivação à mão:
  //   P1: min(1000, 1000*0.5) = 500 ; remaining 1000-500 = 500
  //   P2: min(500,  1000*0.5) = min(500, 500) = 500 ; remaining 500-500 = 0
  //   → ambas 500 (NÃO 500 + 250 do comportamento antigo), leftover 0.
  it("(a) percentage 50%/50% sobre 1000 → 500 e 500 (não 500+250)", () => {
    const goals = [
      goal({ id: "p1", name: "P1", priority: 1, mode: "percentage", value: 0.5, target: 100000, current: 0 }),
      goal({ id: "p2", name: "P2", priority: 2, mode: "percentage", value: 0.5, target: 100000, current: 0 }),
    ];
    const { lines, leftover } = computeAllocationPlan(goals, 1000, BRL, {});

    expect(byId(lines, "p1").allocated).toBe(500);
    expect(byId(lines, "p2").allocated).toBe(500);
    expect(leftover).toBe(0);
  });

  // ── Caso (b): waterfall cap + redistribuição ──────────────────────────────
  // A falta 100 (target 200, current 100), B falta muito (target 100000, current 0).
  // sobra 5000, ambas waterfall.
  // Derivação à mão (loop de redistribuição):
  //   cap A=100, cap B=100000. remaining=5000.
  //   iter1: open=[A,B], each=2500 → A recebe min(2500,100)=100 (cap A→0),
  //          B recebe min(2500,100000)=2500. consumed=2600, remaining=2400.
  //   iter2: open=[B], each=2400 → B recebe min(2400,97500)=2400. remaining=0.
  //   → A=100, B=4900, leftover=0.
  it("(b) waterfall: quase-cheia recebe só o que falta, resto vai pra outra", () => {
    const goals = [
      goal({ id: "A", name: "A", priority: 1, mode: "waterfall", value: null, target: 200, current: 100 }),
      goal({ id: "B", name: "B", priority: 2, mode: "waterfall", value: null, target: 100000, current: 0 }),
    ];
    const { lines, leftover } = computeAllocationPlan(goals, 5000, BRL, {});

    expect(byId(lines, "A").allocated).toBe(100);
    expect(byId(lines, "B").allocated).toBe(4900);
    expect(leftover).toBe(0);
  });

  // ── Caso (c): fixed_amount capado por remainingToTarget ───────────────────
  // value=1000, target=300, current=250 → remainingToTarget=50. savings=2000.
  // Derivação à mão:
  //   alloc = min(2000, 1000) = 1000 ; cap por remainingToTarget: min(1000, 50) = 50.
  //   remaining = 2000-50 = 1950.
  //   → meta=50, leftover=1950.
  it("(c) fixed_amount é capado pelo que falta pra concluir a meta", () => {
    const goals = [
      goal({ id: "f", name: "F", priority: 1, mode: "fixed_amount", value: 1000, target: 300, current: 250 }),
    ];
    const { lines, leftover } = computeAllocationPlan(goals, 2000, BRL, {});

    expect(byId(lines, "f").allocated).toBe(50);
    expect(leftover).toBe(1950);
  });

  // ── Caso (d): leftover quando sobra excede o total faltante ────────────────
  // fixed (cap 100, value 80) + waterfall (cap 200). savings=1000.
  // Derivação à mão:
  //   fixed: alloc=min(1000,80)=80 ; cap remainingToTarget=min(80,100)=80. remaining=920.
  //   waterfall: cap=200. iter1: each=920 → recebe min(920,200)=200. remaining=720.
  //              iter2: cap=0 → break.
  //   → fixed=80, waterfall=200, leftover=720 (= 1000-80-200).
  it("(d) leftover correto quando a sobra excede o total faltante", () => {
    const goals = [
      goal({ id: "fx", name: "FX", priority: 1, mode: "fixed_amount", value: 80, target: 200, current: 100 }),
      goal({ id: "wf", name: "WF", priority: 2, mode: "waterfall", value: null, target: 250, current: 50 }),
    ];
    const { lines, leftover } = computeAllocationPlan(goals, 1000, BRL, {});

    expect(byId(lines, "fx").allocated).toBe(80);
    expect(byId(lines, "wf").allocated).toBe(200);
    expect(leftover).toBe(720);
  });

  // ── Sanidade 1: percentage simples, não capado ────────────────────────────
  // value=0.3, savings=1000, target alto → min(1000, 1000*0.3)=300. leftover=700.
  it("(sanidade) percentage 30% de 1000 → 300, leftover 700", () => {
    const goals = [
      goal({ id: "s1", name: "S1", priority: 1, mode: "percentage", value: 0.3, target: 100000, current: 0 }),
    ];
    const { lines, leftover } = computeAllocationPlan(goals, 1000, BRL, {});

    expect(byId(lines, "s1").allocated).toBe(300);
    expect(leftover).toBe(700);
  });

  // ── Sanidade 2: waterfall único sem cap consome tudo ──────────────────────
  // target alto → cap grande. savings=1500 → meta recebe 1500, leftover 0.
  it("(sanidade) waterfall único consome toda a sobra", () => {
    const goals = [
      goal({ id: "w1", name: "W1", priority: 1, mode: "waterfall", value: null, target: 100000, current: 0 }),
    ];
    const { lines, leftover } = computeAllocationPlan(goals, 1500, BRL, {});

    expect(byId(lines, "w1").allocated).toBe(1500);
    expect(leftover).toBe(0);
  });

  // ── Sanidade 3: metas arquivadas / já concluídas são filtradas ─────────────
  // arquivada e já-concluída não entram; só a ativa recebe.
  it("(sanidade) filtra arquivadas e concluídas", () => {
    const goals = [
      goal({ id: "arch", name: "Arch", priority: 1, mode: "waterfall", value: null, target: 1000, current: 0, archived: true }),
      goal({ id: "done", name: "Done", priority: 2, mode: "waterfall", value: null, target: 1000, current: 1000 }),
      goal({ id: "active", name: "Active", priority: 3, mode: "waterfall", value: null, target: 100000, current: 0 }),
    ];
    const { lines, leftover } = computeAllocationPlan(goals, 800, BRL, {});

    // só a ativa aparece nas linhas
    expect(lines.map((l) => l.goalId)).toEqual(["active"]);
    expect(byId(lines, "active").allocated).toBe(800);
    expect(leftover).toBe(0);
  });
});
