import { describe, it, expect } from "vitest";
import { aad, concat, timingSafeEqual, u64be, utf8, wipe, toBase64url, fromBase64url } from "./bytes";

describe("base64url (segredo do link de share)", () => {
  it("round-trip preserva os bytes e é URL-safe (sem + / =)", () => {
    for (let n = 0; n <= 33; n++) {
      const bytes = new Uint8Array(n).map((_, i) => (i * 37 + 11) & 0xff);
      const s = toBase64url(bytes);
      expect(s).not.toMatch(/[+/=]/);
      expect(Array.from(fromBase64url(s))).toEqual(Array.from(bytes));
    }
  });
});

describe("aad (dado autenticado canônico)", () => {
  it("é não-ambíguo: prefixar por tamanho evita colisão de concatenação", () => {
    expect(Array.from(aad("ab", "c"))).not.toEqual(Array.from(aad("a", "bc")));
  });
  it("é determinístico", () => {
    expect(Array.from(aad("u1", "wrap-pw-v1"))).toEqual(Array.from(aad("u1", "wrap-pw-v1")));
  });
});

describe("utilitários", () => {
  it("concat junta na ordem", () => {
    expect(Array.from(concat(utf8("a"), utf8("bc")))).toEqual(Array.from(utf8("abc")));
  });
  it("u64be é big-endian de 8 bytes", () => {
    expect(Array.from(u64be(1))).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });
  it("timingSafeEqual compara conteúdo", () => {
    expect(timingSafeEqual(utf8("abc"), utf8("abc"))).toBe(true);
    expect(timingSafeEqual(utf8("abc"), utf8("abd"))).toBe(false);
    expect(timingSafeEqual(utf8("abc"), utf8("ab"))).toBe(false);
  });
  it("wipe zera o buffer", () => {
    const b = utf8("secret");
    wipe(b);
    expect(b.every((x) => x === 0)).toBe(true);
  });
});
