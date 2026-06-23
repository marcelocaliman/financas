import { describe, it, expect, beforeEach } from "vitest";
import { useProjection, SCENARIO_KEYS } from "./projection";
import { projectBalance } from "@/finance/projection";

/** Reconstrói a curva EXATAMENTE como a página (projecao.tsx): projectBalance por cenário/ano. */
function buildSeries(initial: number, years: number): Record<string, number[]> {
  const sc = useProjection.getState().scenarios;
  const out: Record<string, number[]> = {};
  for (const k of SCENARIO_KEYS) {
    out[k] = [];
    for (let yr = 0; yr <= years; yr++) out[k].push(projectBalance(initial, sc[k].monthly, sc[k].annualReturn / 100, yr));
  }
  return out;
}

describe("useProjection — editar cenário recalcula a projeção", () => {
  beforeEach(() => {
    useProjection.setState({
      scenarios: {
        pessimistic: { annualReturn: 5, monthly: 1000 },
        base: { annualReturn: 8, monthly: 1000 },
        optimistic: { annualReturn: 11, monthly: 1000 },
      },
    });
  });

  it("setScenario cria NOVA referência de scenarios (é o que dispara o recomputo do useMemo da curva)", () => {
    const before = useProjection.getState().scenarios;
    useProjection.getState().setScenario("base", { annualReturn: 10 });
    const after = useProjection.getState().scenarios;
    expect(after).not.toBe(before); // referência nova → useMemo([initial, sc, years]) recalcula
    expect(after.base.annualReturn).toBe(10);
    expect(after.base.monthly).toBe(1000); // patch parcial preserva o resto do cenário
  });

  it("mudar o RETORNO a.a. move a curva daquele cenário — e só dele", () => {
    const initial = 100000;
    const years = 20;
    const a = buildSeries(initial, years);
    useProjection.getState().setScenario("pessimistic", { annualReturn: 9 });
    const b = buildSeries(initial, years);
    expect(b.pessimistic[years]).toBeGreaterThan(a.pessimistic[years]); // 5%→9% sobe o saldo final
    expect(b.base[years]).toBe(a.base[years]); // cenários não tocados ficam idênticos
    expect(b.optimistic[years]).toBe(a.optimistic[years]);
  });

  it("mudar o APORTE mensal move a curva (1.000 → 10.000 = muito maior)", () => {
    const initial = 100000;
    const years = 20;
    const a = buildSeries(initial, years);
    useProjection.getState().setScenario("base", { monthly: 10000 });
    const b = buildSeries(initial, years);
    expect(b.base[years]).toBeGreaterThan(a.base[years] * 3);
  });

  it("set({ years }) e set({ annualInflation }) atualizam os parâmetros compartilhados", () => {
    useProjection.getState().set({ years: 30, annualInflation: 6 });
    expect(useProjection.getState().years).toBe(30);
    expect(useProjection.getState().annualInflation).toBe(6);
  });
});
