import { ivFromCounter, randomBytes } from "./aead";
import { wipe, timingSafeEqual } from "./bytes";
import { DEFAULT_KDF, deriveArgon2id, type KdfParams } from "./kdf";
import {
  deriveServerAuthTag,
  deriveWrappingKey,
  generateDek,
  importVaultKey,
  PWK_INFO,
  pwWrapAad,
  RWK_INFO,
  recoveryWrapAad,
  unwrapDek,
  wrapDek,
} from "./keys";
import { generateRecoveryCode, parseRecoveryCode } from "./recovery-code";

/**
 * Orquestração do envelope de chaves. Funções puras (sem rede) — o servidor só
 * guarda os campos `VaultMeta`. Toda operação que precisa dos bytes crus da DEK
 * os obtém transitoriamente (desembrulho) e os zera em seguida.
 */

const SALT_BYTES = 16;
const WRAP_IV = ivFromCounter(0n); // cada chave de embrulho cifra a DEK UMA vez → IV fixo é seguro

export interface VaultMeta {
  userId: string;
  kdfParams: KdfParams;
  salt: Uint8Array;
  saltRecovery: Uint8Array;
  wrappedDekPw: Uint8Array;
  wrappedDekPwIv: Uint8Array;
  wrappedDekRecovery: Uint8Array;
  wrappedDekRecoveryIv: Uint8Array;
}

/** Chaves vivas da sessão: a DEK (não-exportável) + a prova de posse pro servidor. */
export interface VaultKeys {
  dek: CryptoKey;
  authTag: Uint8Array;
}

export interface NewVault extends VaultMeta, VaultKeys {
  /** Mostrado UMA vez no cadastro (round-trip de confirmação obrigatório na UI). */
  recoveryCode: string;
}

/** Cadastro: gera DEK + as duas vias de embrulho (senha e código). */
export async function createVault(
  userId: string,
  password: string,
  kdfParams: KdfParams = DEFAULT_KDF,
): Promise<NewVault> {
  const salt = randomBytes(SALT_BYTES);
  const saltRecovery = randomBytes(SALT_BYTES);
  const dekBytes = generateDek();
  try {
    // Via senha
    const pwMaterial = await deriveArgon2id(password, salt, kdfParams);
    const pwk = await deriveWrappingKey(pwMaterial, PWK_INFO, salt);
    wipe(pwMaterial);
    const wrappedDekPw = await wrapDek(pwk, dekBytes, WRAP_IV, pwWrapAad(userId, kdfParams, salt));

    // Via código de recuperação
    const { code: recoveryCode, bytes: recBytes } = generateRecoveryCode();
    const rwk = await deriveWrappingKey(recBytes, RWK_INFO, saltRecovery);
    wipe(recBytes);
    const wrappedDekRecovery = await wrapDek(
      rwk,
      dekBytes,
      WRAP_IV,
      recoveryWrapAad(userId, saltRecovery),
    );

    const authTag = await deriveServerAuthTag(dekBytes);
    const dek = await importVaultKey(dekBytes);
    return {
      userId,
      kdfParams,
      salt,
      saltRecovery,
      wrappedDekPw,
      wrappedDekPwIv: WRAP_IV,
      wrappedDekRecovery,
      wrappedDekRecoveryIv: WRAP_IV,
      recoveryCode,
      dek,
      authTag,
    };
  } finally {
    wipe(dekBytes);
  }
}

async function bytesToKeys(dekBytes: Uint8Array): Promise<VaultKeys> {
  try {
    const authTag = await deriveServerAuthTag(dekBytes);
    const dek = await importVaultKey(dekBytes);
    return { dek, authTag };
  } finally {
    wipe(dekBytes);
  }
}

/** Destrava o cofre com a senha. LANÇA se a senha estiver errada. */
export async function unlockWithPassword(meta: VaultMeta, password: string): Promise<VaultKeys> {
  const material = await deriveArgon2id(password, meta.salt, meta.kdfParams);
  const pwk = await deriveWrappingKey(material, PWK_INFO, meta.salt);
  wipe(material);
  const dekBytes = await unwrapDek(
    pwk,
    meta.wrappedDekPw,
    meta.wrappedDekPwIv,
    pwWrapAad(meta.userId, meta.kdfParams, meta.salt),
  );
  return bytesToKeys(dekBytes);
}

/** Destrava o cofre com o código de recuperação. LANÇA se o código estiver errado. */
export async function unlockWithRecoveryCode(meta: VaultMeta, code: string): Promise<VaultKeys> {
  const recBytes = parseRecoveryCode(code);
  const rwk = await deriveWrappingKey(recBytes, RWK_INFO, meta.saltRecovery);
  wipe(recBytes);
  const dekBytes = await unwrapDek(
    rwk,
    meta.wrappedDekRecovery,
    meta.wrappedDekRecoveryIv,
    recoveryWrapAad(meta.userId, meta.saltRecovery),
  );
  return bytesToKeys(dekBytes);
}

export interface PwRewrap {
  salt: Uint8Array;
  kdfParams: KdfParams;
  wrappedDekPw: Uint8Array;
  wrappedDekPwIv: Uint8Array;
}

/**
 * Troca de senha. Re-embrulha a DEK sob a nova senha SEM recifrar o cofre (a DEK
 * não muda). Exige a senha ATUAL (re-auth → prova de posse). Faz SELF-TEST: só
 * retorna depois de confirmar que a nova PWK desembrulha a DEK. Em qualquer falha,
 * lança e nada deve ser persistido (o chamado grava de forma atômica).
 */
export async function rewrapPassword(
  meta: VaultMeta,
  currentPassword: string,
  newPassword: string,
  newKdf: KdfParams = DEFAULT_KDF,
): Promise<PwRewrap> {
  // 1) Destrava com a senha atual → bytes da DEK
  const curMaterial = await deriveArgon2id(currentPassword, meta.salt, meta.kdfParams);
  const curPwk = await deriveWrappingKey(curMaterial, PWK_INFO, meta.salt);
  wipe(curMaterial);
  const dekBytes = await unwrapDek(
    curPwk,
    meta.wrappedDekPw,
    meta.wrappedDekPwIv,
    pwWrapAad(meta.userId, meta.kdfParams, meta.salt),
  );
  try {
    // 2) Novo embrulho com NOVO salt
    const salt = randomBytes(SALT_BYTES);
    const material = await deriveArgon2id(newPassword, salt, newKdf);
    const pwk = await deriveWrappingKey(material, PWK_INFO, salt);
    wipe(material);
    const wrapAad = pwWrapAad(meta.userId, newKdf, salt);
    const wrappedDekPw = await wrapDek(pwk, dekBytes, WRAP_IV, wrapAad);

    // 3) SELF-TEST: a nova PWK precisa desembrulhar a MESMA DEK antes de declarar sucesso
    const check = await unwrapDek(pwk, wrappedDekPw, WRAP_IV, wrapAad);
    const ok = timingSafeEqual(check, dekBytes);
    wipe(check);
    if (!ok) throw new Error("self-test da troca de senha falhou — abortado, nada alterado");

    return { salt, kdfParams: newKdf, wrappedDekPw, wrappedDekPwIv: WRAP_IV };
  } finally {
    wipe(dekBytes);
  }
}

export interface RecoveryRewrap {
  saltRecovery: Uint8Array;
  wrappedDekRecovery: Uint8Array;
  wrappedDekRecoveryIv: Uint8Array;
  recoveryCode: string;
}

/** Rotaciona o código de recuperação (novo código + novo embrulho). Exige a senha. */
export async function rotateRecoveryCode(
  meta: VaultMeta,
  password: string,
): Promise<RecoveryRewrap> {
  const material = await deriveArgon2id(password, meta.salt, meta.kdfParams);
  const pwk = await deriveWrappingKey(material, PWK_INFO, meta.salt);
  wipe(material);
  const dekBytes = await unwrapDek(
    pwk,
    meta.wrappedDekPw,
    meta.wrappedDekPwIv,
    pwWrapAad(meta.userId, meta.kdfParams, meta.salt),
  );
  try {
    const saltRecovery = randomBytes(SALT_BYTES);
    const { code: recoveryCode, bytes: recBytes } = generateRecoveryCode();
    const rwk = await deriveWrappingKey(recBytes, RWK_INFO, saltRecovery);
    wipe(recBytes);
    const wrapAad = recoveryWrapAad(meta.userId, saltRecovery);
    const wrappedDekRecovery = await wrapDek(rwk, dekBytes, WRAP_IV, wrapAad);

    const check = await unwrapDek(rwk, wrappedDekRecovery, WRAP_IV, wrapAad);
    const ok = timingSafeEqual(check, dekBytes);
    wipe(check);
    if (!ok) throw new Error("self-test da rotação de código falhou");

    return { saltRecovery, wrappedDekRecovery, wrappedDekRecoveryIv: WRAP_IV, recoveryCode };
  } finally {
    wipe(dekBytes);
  }
}
