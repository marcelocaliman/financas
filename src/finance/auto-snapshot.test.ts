import { describe, it, expect } from "vitest";
import { planCurrentMonthAuto, type SnapshotOp } from "./auto-snapshot";
import type { NetWorthSnapshot } from "@/domain/types";

const snap = (over: Partial<NetWorthSnapshot> = {}): NetWorthSnapshot => ({
  id: "s", month: "2026-07", currency: "BRL", amount: 1000, auto: true, ...over,
});

const puts = (ops: SnapshotOp[]) => ops.filter((o) => o.type === "put").map((o) => (o as { snapshot: NetWorthSnapshot }).snapshot);
const removes = (ops: SnapshotOp[]) => ops.filter((o) => o.type === "remove").map((o) => (o as { id: string }).id);

describe("planCurrentMonthAuto — um auto por mês, id determinístico", () => {
  it("mês vazio → cria UM auto com id determinístico `auto-AAAA-MM`", () => {
    const ops = planCurrentMonthAuto([], "2026-07", "BRL", 5000, 200);
    expect(puts(ops)).toEqual([{ id: "auto-2026-07", month: "2026-07", currency: "BRL", amount: 5000, contribution: 200, auto: true }]);
    expect(removes(ops)).toEqual([]);
  });

  it("id é determinístico: dois planejamentos no mesmo mês colidem no MESMO id (idempotente)", () => {
    // Simula o efeito disparando 2× antes do 1º snapshot propagar: ambos usam o mesmo id →
    // no banco o 2º sobrescreve o 1º (não nascem 2 linhas).
    const a = puts(planCurrentMonthAuto([], "2026-07", "BRL", 5000, 200))[0];
    const b = puts(planCurrentMonthAuto([], "2026-07", "BRL", 5100, 210))[0];
    expect(a.id).toBe(b.id);
    expect(a.id).toBe("auto-2026-07");
  });

  it("DUPLICATAS existentes (2 autos de id aleatório) → limpa e mantém 1 determinístico", () => {
    // O estado ruim que o usuário viu: 2 linhas de julho, ambas auto, ids aleatórios.
    const rows = [snap({ id: "uuid-a", amount: 602416.67, contribution: 2067.86 }), snap({ id: "uuid-b", amount: 601178.62, contribution: 2667.86 })];
    const ops = planCurrentMonthAuto(rows, "2026-07", "BRL", 601178.62, 2667.86);
    // Remove AMBOS os aleatórios e cria o canônico com o patrimônio atual.
    expect(removes(ops).sort()).toEqual(["uuid-a", "uuid-b"]);
    const created = puts(ops);
    expect(created).toHaveLength(1);
    expect(created[0].id).toBe("auto-2026-07");
    expect(created[0].amount).toBe(601178.62);
  });

  it("já tem o auto canônico + um aleatório duplicado → remove só o aleatório", () => {
    const rows = [snap({ id: "auto-2026-07", amount: 5000, contribution: 200 }), snap({ id: "uuid-stale", amount: 4800, contribution: 100 })];
    const ops = planCurrentMonthAuto(rows, "2026-07", "BRL", 5000, 200);
    expect(removes(ops)).toEqual(["uuid-stale"]);
    expect(puts(ops)).toEqual([]); // canônico já alinhado → nenhum put
  });

  it("linha MANUAL (auto:false) manda → remove qualquer auto e não cria nada", () => {
    const rows = [snap({ id: "manual", auto: false, amount: 7000 }), snap({ id: "auto-2026-07", amount: 5000 })];
    const ops = planCurrentMonthAuto(rows, "2026-07", "BRL", 5000, 200);
    expect(removes(ops)).toEqual(["auto-2026-07"]);
    expect(puts(ops)).toEqual([]);
  });

  it("auto canônico desalinhado (patrimônio mudou) → atualiza no lugar", () => {
    const rows = [snap({ id: "auto-2026-07", amount: 5000, contribution: 200 })];
    const ops = planCurrentMonthAuto(rows, "2026-07", "BRL", 5300, 250);
    expect(removes(ops)).toEqual([]);
    expect(puts(ops)).toEqual([{ id: "auto-2026-07", month: "2026-07", currency: "BRL", amount: 5300, contribution: 250, auto: true }]);
  });

  it("mudança menor que meio centavo não gera put (evita escrita em loop)", () => {
    const rows = [snap({ id: "auto-2026-07", amount: 5000, contribution: 200 })];
    const ops = planCurrentMonthAuto(rows, "2026-07", "BRL", 5000.0001, 200.0001);
    expect(ops).toEqual([]);
  });

  it("moeda-base trocada → realinha o auto à nova moeda", () => {
    const rows = [snap({ id: "auto-2026-07", currency: "USD", amount: 5000, contribution: 200 })];
    const ops = planCurrentMonthAuto(rows, "2026-07", "BRL", 5000, 200);
    expect(puts(ops)[0].currency).toBe("BRL");
  });

  it("não toca em snapshots de OUTROS meses", () => {
    const rows = [snap({ id: "auto-2026-06", month: "2026-06", amount: 4000 }), snap({ id: "auto-2026-07", amount: 5000, contribution: 200 })];
    const ops = planCurrentMonthAuto(rows, "2026-07", "BRL", 5000, 200);
    expect(ops).toEqual([]); // junho intacto, julho já alinhado
  });
});
