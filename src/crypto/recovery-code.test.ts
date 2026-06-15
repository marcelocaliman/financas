import { describe, it, expect } from "vitest";
import { generateRecoveryCode, parseRecoveryCode, RECOVERY_BYTES } from "./recovery-code";
import { timingSafeEqual } from "./bytes";

describe("código de recuperação", () => {
  it("gera 16 bytes (128 bits) e faz round-trip", () => {
    const { code, bytes } = generateRecoveryCode();
    expect(bytes.length).toBe(RECOVERY_BYTES);
    expect(timingSafeEqual(parseRecoveryCode(code), bytes)).toBe(true);
  });

  it("é apresentado em grupos com hífen", () => {
    const { code } = generateRecoveryCode();
    expect(code).toContain("-");
  });

  it("parse ignora caixa, hífens e espaços", () => {
    const { code, bytes } = generateRecoveryCode();
    const messy = ` ${code.toLowerCase().replace(/-/g, " ")} `;
    expect(timingSafeEqual(parseRecoveryCode(messy), bytes)).toBe(true);
  });

  it("trata confusáveis: I/L → 1 e O → 0", () => {
    const ones = "11111-11111-11111-11111-11111-1";
    expect(Array.from(parseRecoveryCode(ones))).toEqual(Array.from(parseRecoveryCode("IIIII-IIIII-IIIII-IIIII-IIIII-I")));
    expect(Array.from(parseRecoveryCode(ones))).toEqual(Array.from(parseRecoveryCode("LLLLL-LLLLL-LLLLL-LLLLL-LLLLL-L")));
    const zeros = "00000-00000-00000-00000-00000-0";
    expect(Array.from(parseRecoveryCode(zeros))).toEqual(Array.from(parseRecoveryCode("OOOOO-OOOOO-OOOOO-OOOOO-OOOOO-O")));
  });

  it("caractere inválido → LANÇA", () => {
    expect(() => parseRecoveryCode("UUUUU-UUUUU")).toThrow(); // 'U' não existe no Crockford
    expect(() => parseRecoveryCode("@@@@@")).toThrow();
  });
});
