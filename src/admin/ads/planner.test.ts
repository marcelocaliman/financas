import { describe, it, expect } from "vitest";
import { orderPieces, generateSchedule } from "./planner";

describe("orderPieces (variedade)", () => {
  it("não cola duas peças do mesmo pilar quando dá pra evitar", () => {
    const pool = [
      { id: "a1", pillar: "A", format: "post" as const, edu: false },
      { id: "a2", pillar: "A", format: "post" as const, edu: false },
      { id: "b1", pillar: "B", format: "carousel" as const, edu: false },
      { id: "c1", pillar: "C", format: "post" as const, edu: true },
    ];
    const o = orderPieces(pool);
    expect(o).toHaveLength(4);
    expect(new Set(o.map((p) => p.id)).size).toBe(4); // sem duplicar
    for (let i = 1; i < o.length; i++) expect(o[i].pillar).not.toBe(o[i - 1].pillar);
  });

  it("respeita o seed (1ª peça fixa)", () => {
    const pool = [
      { id: "x", pillar: "A", format: "post" as const, edu: false },
      { id: "seed", pillar: "B", format: "carousel" as const, edu: false },
    ];
    expect(orderPieces(pool, "seed")[0].id).toBe("seed");
  });

  it("é determinístico", () => {
    const pool = [
      { id: "a1", pillar: "A", format: "post" as const, edu: false },
      { id: "b1", pillar: "B", format: "reel" as const, edu: true },
      { id: "c1", pillar: "C", format: "carousel" as const, edu: false },
    ];
    expect(orderPieces(pool).map((p) => p.id)).toEqual(orderPieces(pool).map((p) => p.id));
  });
});

describe("generateSchedule (roteiro)", () => {
  it("preenche 4 semanas (equilibrado) sem repetir peça e liderando pelo carrossel de apresentação", () => {
    const plan = generateSchedule(new Date(2026, 6, 1), 4, "equilibrado");
    expect(plan.length).toBe(20); // 3 feed + 2 reels por semana = 5/sem × 4 semanas (story leve não é peça)
    const ids = plan.map((e) => e.pieceId);
    expect(new Set(ids).size).toBe(ids.length); // nenhuma peça repetida na janela
    const firstFeed = plan.find((e) => e.pieceId.startsWith("post:") || e.pieceId.startsWith("carousel:"));
    expect(firstFeed?.pieceId).toBe("carousel:tour");
    // datas em ordem crescente
    for (let i = 1; i < plan.length; i++) expect(plan[i].date >= plan[i - 1].date).toBe(true);
  });

  it("intensidade leve gera menos que a intensa", () => {
    const leve = generateSchedule(new Date(2026, 6, 1), 4, "leve");
    const intenso = generateSchedule(new Date(2026, 6, 1), 4, "intenso");
    expect(leve.length).toBeLessThan(intenso.length);
  });
});
