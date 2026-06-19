import { describe, it, expect } from "vitest";
import {
  createVault,
  rewrapPassword,
  rotateRecoveryCode,
  unlockWithPassword,
  unlockWithRecoveryCode,
  wrapDekForShare,
  unlockWithShare,
  type VaultMeta,
  type ShareWrap,
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
    expect(await isSameDek(v.dek, byPw.dek)).toBe(true);
    expect(await isSameDek(v.dek, byCode.dek)).toBe(true);
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
    expect(await isSameDek(v.dek, byNew.dek)).toBe(true); // mesma DEK (cofre não recifrado)
    await expect(unlockWithPassword(m2, PW)).rejects.toThrow(); // senha antiga não vale mais

    // código de recuperação continua válido após troca de senha
    const byCode = await unlockWithRecoveryCode(m2, v.recoveryCode);
    expect(await isSameDek(v.dek, byCode.dek)).toBe(true);
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
    expect(await isSameDek(v.dek, byNew.dek)).toBe(true);
    await expect(unlockWithRecoveryCode(m3, v.recoveryCode)).rejects.toThrow();
  });

  it("anti-downgrade: adulterar kdfParams quebra o unlock (AAD + derivação)", async () => {
    const v = await createVault(USER, PW, FAST);
    const tampered: VaultMeta = { ...meta(v), kdfParams: { ...meta(v).kdfParams, m: 32_768 } };
    await expect(unlockWithPassword(tampered, PW)).rejects.toThrow();
  });
});

describe("envelope — acesso da família (share só-leitura)", () => {
  const shareMeta = (userId: string, sh: ShareWrap) => ({
    userId,
    saltShare: sh.saltShare,
    wrappedDekShare: sh.wrappedDekShare,
    wrappedDekShareIv: sh.wrappedDekShareIv,
  });

  it("o segredo do link destrava a MESMA DEK", async () => {
    const v = await createVault(USER, PW, FAST);
    const sh = await wrapDekForShare(meta(v), PW);
    const byShare = await unlockWithShare(shareMeta(USER, sh), sh.secret);
    expect(await isSameDek(v.dek, byShare.dek)).toBe(true);
  });

  it("senha errada ao criar o share → LANÇA (re-auth)", async () => {
    const v = await createVault(USER, PW, FAST);
    await expect(wrapDekForShare(meta(v), "senha-errada")).rejects.toThrow();
  });

  it("segredo errado no viewer → LANÇA", async () => {
    const v = await createVault(USER, PW, FAST);
    const sh = await wrapDekForShare(meta(v), PW);
    const wrong = (sh.secret[0] === "A" ? "B" : "A") + sh.secret.slice(1);
    await expect(unlockWithShare(shareMeta(USER, sh), wrong)).rejects.toThrow();
  });

  it("share sobrevive à troca de senha (DEK estável)", async () => {
    const v = await createVault(USER, PW, FAST);
    const sh = await wrapDekForShare(meta(v), PW);
    await rewrapPassword(meta(v), PW, "nova-senha-qualquer-tres", FAST);
    const byShare = await unlockWithShare(shareMeta(USER, sh), sh.secret);
    expect(await isSameDek(v.dek, byShare.dek)).toBe(true);
  });

  it("adulterar userId (AAD) quebra o unlock do share", async () => {
    const v = await createVault(USER, PW, FAST);
    const sh = await wrapDekForShare(meta(v), PW);
    await expect(unlockWithShare(shareMeta("outro-user", sh), sh.secret)).rejects.toThrow();
  });
});
