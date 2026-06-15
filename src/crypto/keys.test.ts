import { describe, it, expect } from "vitest";
import { randomBytes } from "./aead";
import {
  deriveWrappingKey,
  generateDek,
  importVaultKey,
  pwWrapAad,
  unwrapDek,
  wrapDek,
} from "./keys";
import { DEFAULT_KDF } from "./kdf";
import { ivFromCounter } from "./aead";
import { timingSafeEqual } from "./bytes";

const IV = ivFromCounter(0n);

describe("embrulho/desembrulho da DEK", () => {
  it("round-trip recupera os mesmos bytes da DEK", async () => {
    const dek = generateDek();
    const wk = await deriveWrappingKey(randomBytes(32), "pwk-v1", randomBytes(16));
    const aadW = pwWrapAad("u1", DEFAULT_KDF, randomBytes(16));
    const wrapped = await wrapDek(wk, dek, IV, aadW);
    const back = await unwrapDek(wk, wrapped, IV, aadW);
    expect(timingSafeEqual(back, dek)).toBe(true);
  });

  it("chave de embrulho errada → desembrulho LANÇA", async () => {
    const dek = generateDek();
    const salt = randomBytes(16);
    const aadW = pwWrapAad("u1", DEFAULT_KDF, salt);
    const wk1 = await deriveWrappingKey(randomBytes(32), "pwk-v1", salt);
    const wk2 = await deriveWrappingKey(randomBytes(32), "pwk-v1", salt);
    const wrapped = await wrapDek(wk1, dek, IV, aadW);
    await expect(unwrapDek(wk2, wrapped, IV, aadW)).rejects.toThrow();
  });

  it("AAD divergente → desembrulho LANÇA", async () => {
    const dek = generateDek();
    const salt = randomBytes(16);
    const wk = await deriveWrappingKey(randomBytes(32), "pwk-v1", salt);
    const wrapped = await wrapDek(wk, dek, IV, pwWrapAad("u1", DEFAULT_KDF, salt));
    await expect(
      unwrapDek(wk, wrapped, IV, pwWrapAad("OUTRO-USER", DEFAULT_KDF, salt)),
    ).rejects.toThrow();
  });

  it("importVaultKey gera chave não-exportável", async () => {
    const k = await importVaultKey(generateDek());
    expect(k.extractable).toBe(false);
  });
});
