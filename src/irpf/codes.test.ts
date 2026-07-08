import { describe, it, expect } from "vitest";
import { defaultBaseYear, yearCloseWindow } from "./codes";

describe("defaultBaseYear (ano que se prepara agora)", () => {
  it("jun–dez → ano atual (monta a estrutura, fecha o valor no fim do ano)", () => {
    expect(defaultBaseYear(new Date(2025, 5, 1))).toBe(2025);  // junho
    expect(defaultBaseYear(new Date(2025, 11, 31))).toBe(2025); // dezembro
  });
  it("jan–mai → ano anterior (temporada de declarar a posição do ano passado)", () => {
    expect(defaultBaseYear(new Date(2026, 0, 5))).toBe(2025);  // janeiro
    expect(defaultBaseYear(new Date(2026, 4, 20))).toBe(2025); // maio
  });
});

describe("yearCloseWindow (janela de Fechar o ano)", () => {
  it("dezembro → fecha o ano atual", () => {
    expect(yearCloseWindow(new Date(2025, 11, 10))).toBe(2025);
  });
  it("jan–mar → fecha o ano anterior (informes chegam atrasados)", () => {
    expect(yearCloseWindow(new Date(2026, 0, 10))).toBe(2025);
    expect(yearCloseWindow(new Date(2026, 2, 31))).toBe(2025);
  });
  it("fora da janela (abr–nov) → null", () => {
    expect(yearCloseWindow(new Date(2026, 3, 1))).toBeNull();  // abril
    expect(yearCloseWindow(new Date(2026, 10, 30))).toBeNull(); // novembro
  });
});
