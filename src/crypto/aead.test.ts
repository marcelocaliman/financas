import { describe, it, expect } from "vitest";
import { aeadDecrypt, aeadEncrypt, importAesKey, ivFromCounter, randomBytes } from "./aead";
import { utf8 } from "./bytes";

async function key() {
  return importAesKey(randomBytes(32));
}

describe("AES-GCM com AAD obrigatória", () => {
  it("round-trip cifra/decifra", async () => {
    const k = await key();
    const iv = ivFromCounter(7n);
    const ad = utf8("ctx");
    const ct = await aeadEncrypt(k, utf8("olá mundo"), iv, ad);
    const pt = await aeadDecrypt(k, ct, iv, ad);
    expect(new TextDecoder().decode(pt)).toBe("olá mundo");
  });

  it("AAD diferente → decifra LANÇA (substituição de contexto barrada)", async () => {
    const k = await key();
    const iv = ivFromCounter(1n);
    const ct = await aeadEncrypt(k, utf8("x"), iv, utf8("ctx-A"));
    await expect(aeadDecrypt(k, ct, iv, utf8("ctx-B"))).rejects.toThrow();
  });

  it("ciphertext adulterado → decifra LANÇA", async () => {
    const k = await key();
    const iv = ivFromCounter(2n);
    const ad = utf8("ctx");
    const ct = await aeadEncrypt(k, utf8("x"), iv, ad);
    ct[0] ^= 0xff;
    await expect(aeadDecrypt(k, ct, iv, ad)).rejects.toThrow();
  });
});

describe("ivFromCounter", () => {
  it("contadores distintos → IVs distintos, 12 bytes", () => {
    const a = ivFromCounter(0n);
    const b = ivFromCounter(1n);
    expect(a.length).toBe(12);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
  it("rejeita fora de 96 bits", () => {
    expect(() => ivFromCounter(-1n)).toThrow();
    expect(() => ivFromCounter(1n << 96n)).toThrow();
  });
});
