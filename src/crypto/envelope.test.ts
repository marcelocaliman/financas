import { describe, it, expect } from "vitest";
import {
  createVault,
  rewrapPassword,
  rotateRecoveryCode,
  unlockWithPassword,
  unlockWithRecoveryCode,
  type VaultMeta,
} from "./envelope";
import { aeadDecrypt, aeadEncrypt, ivFromCounter } from "./aead";
import { KDF_FLOOR, type KdfParams } from "./kdf";
import { utf8 } from "./bytes";

// KDF no piso (válido) — derivação mais rápida que o padrão de 64 MiB, p/ testes ágeis.
const FAST: KdfParams = { algo: "argon2id", m: KDF_FLOOR.m, t: KDF_FLOOR.t, p: 1, v: 0x13 };
const USER = "user-123";
const PW = "senha-correta-horse-battery";

/** Confirma que duas chaves são a MESMA DEK: cifra com uma, decifra com a outra. */
async function isSameDek(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  const iv = ivFromCounter(1n);
  const ad = utf8("probe");
  try {
    const ct = await aeadEncrypt(a, utf8("ping"), iv, ad);
    const pt = await aeadDecrypt(b, ct, iv, ad);
    return new TextDecoder().decode(pt) === "ping";
  } catch {
    return false;
  }
}

function meta(v: Awaited<ReturnType<typeof createVault>>): VaultMeta {
  return {
    userId: v.userId,
    kdfParams: v.kdfParams,
    salt: v.salt,
    saltRecovery: v.saltRecovery,
    wrappedDekPw: v.wrappedDekPw,
    wrappedDekPwIv: v.wrappedDekPwIv,
    wrappedDekRecovery: v.wrappedDekRecovery,
    wrappedDekRecoveryIv: v.wrappedDekRecoveryIv,
  };
}

describe("envelope E2EE — fluxo completo", () => {
  it("cadastro: senha E código destravam a MESMA DEK", async () => {
    const v = await createVault(USER, PW, FAST);
    expect(v.recoveryCode).toContain("-");

    const byPw = await unlockWithPassword(meta(v), PW);
    const byCode = await unlockWithRecoveryCode(meta(v), v.recoveryCode);
    expect(await isSameDek(v.dek, byPw)).toBe(true);
    expect(await isSameDek(v.dek, byCode)).toBe(true);
  });

  it("senha errada e código errado → LANÇAM", async () => {
    const v = await createVault(USER, PW, FAST);
    await expect(unlockWithPassword(meta(v), "senha-errada")).rejects.toThrow();
    await expect(
      unlockWithRecoveryCode(meta(v), "AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-A"),
    ).rejects.toThrow();
  });

  it("troca de senha: nova senha destrava, antiga falha, DEK não muda", async () => {
    const v = await createVault(USER, PW, FAST);
    const NEW = "nova-senha-tres-palavras";
    const rw = await rewrapPassword(meta(v), PW, NEW, FAST);

    const m2: VaultMeta = {
      ...meta(v),
      salt: rw.salt,
      kdfParams: rw.kdfParams,
      wrappedDekPw: rw.wrappedDekPw,
      wrappedDekPwIv: rw.wrappedDekPwIv,
    };
    const byNew = await unlockWithPassword(m2, NEW);
    expect(await isSameDek(v.dek, byNew)).toBe(true); // mesma DEK (cofre não recifrado)
    await expect(unlockWithPassword(m2, PW)).rejects.toThrow(); // senha antiga não vale mais

    // código de recuperação continua válido após troca de senha
    const byCode = await unlockWithRecoveryCode(m2, v.recoveryCode);
    expect(await isSameDek(v.dek, byCode)).toBe(true);
  });

  it("rotação de código: novo código destrava, antigo falha", async () => {
    const v = await createVault(USER, PW, FAST);
    const rot = await rotateRecoveryCode(meta(v), PW);

    const m3: VaultMeta = {
      ...meta(v),
      saltRecovery: rot.saltRecovery,
      wrappedDekRecovery: rot.wrappedDekRecovery,
      wrappedDekRecoveryIv: rot.wrappedDekRecoveryIv,
    };
    const byNew = await unlockWithRecoveryCode(m3, rot.recoveryCode);
    expect(await isSameDek(v.dek, byNew)).toBe(true);
    await expect(unlockWithRecoveryCode(m3, v.recoveryCode)).rejects.toThrow();
  });

  it("anti-downgrade: adulterar kdfParams quebra o unlock (AAD + derivação)", async () => {
    const v = await createVault(USER, PW, FAST);
    const tampered: VaultMeta = { ...meta(v), kdfParams: { ...meta(v).kdfParams, m: 32_768 } };
    await expect(unlockWithPassword(tampered, PW)).rejects.toThrow();
  });
});
