import { aeadDecrypt, aeadEncrypt, importAesKey, randomBytes } from "./aead";
import { aad, ab, utf8 } from "./bytes";
import { canonicalKdf, type KdfParams } from "./kdf";

/**
 * Hierarquia de chaves (envelope de 3 níveis):
 *
 *   DEK (32B aleatórios) — única chave que cifra o cofre
 *     ├── embrulhada por PWK = HKDF(Argon2id(senha, salt))   → wrapped_dek_pw
 *     └── embrulhada por RWK = HKDF(código de recuperação)   → wrapped_dek_recovery
 *
 * A DEK vive em memória como CryptoKey NÃO-exportável (só encrypt/decrypt). Os
 * bytes crus só aparecem transitoriamente no embrulho/desembrulho, com vida mínima.
 */

export const DEK_BYTES = 32;

export function generateDek(): Uint8Array {
  return randomBytes(DEK_BYTES);
}

/** Importa a DEK como chave de cofre NÃO-exportável (cifra/decifra o blob). */
export function importVaultKey(dekBytes: Uint8Array): Promise<CryptoKey> {
  return importAesKey(dekBytes, false);
}

/**
 * Tag de PROVA DE POSSE da DEK, enviada ao servidor (que guarda e compara, numa
 * tabela sem leitura). Derivada por HKDF — não revela a DEK. Uma sessão sem a DEK
 * não consegue recomputá-la → não consegue escrever/destruir o cofre.
 */
export async function deriveServerAuthTag(dekBytes: Uint8Array): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", ab(dekBytes), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: ab(new Uint8Array(0)), info: ab(utf8("server-auth-v1")) },
    base,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Deriva uma chave de EMBRULHO (AES-GCM não-exportável) por HKDF-SHA-256 a partir
 * de um material-base de alta entropia (saída do Argon2id, ou bytes do código).
 */
export async function deriveWrappingKey(
  material: Uint8Array,
  info: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", ab(material), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: ab(salt), info: ab(new TextEncoder().encode(info)) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export const PWK_INFO = "pwk-v1";
export const RWK_INFO = "rwk-v1";
export const SKW_INFO = "skw-v1"; // share wrapping key (acesso da família, só-leitura)

/** AAD do embrulho da senha — amarra a params do KDF + salt (downgrade → desembrulho falha). */
export function pwWrapAad(userId: string, kdf: KdfParams, salt: Uint8Array): Uint8Array {
  return aad(userId, "wrap-pw-v1", canonicalKdf(kdf), salt);
}

/** AAD do embrulho do código de recuperação. */
export function recoveryWrapAad(userId: string, saltRecovery: Uint8Array): Uint8Array {
  return aad(userId, "wrap-recovery-v1", saltRecovery);
}

/** AAD do embrulho de SHARE (acesso da família). Amarra ao dono + salt do share. */
export function shareWrapAad(userId: string, saltShare: Uint8Array): Uint8Array {
  return aad(userId, "wrap-share-v1", saltShare);
}

/** Embrulha a DEK com uma chave de embrulho. */
export function wrapDek(
  wrappingKey: CryptoKey,
  dekBytes: Uint8Array,
  iv: Uint8Array,
  wrapAad: Uint8Array,
): Promise<Uint8Array> {
  return aeadEncrypt(wrappingKey, dekBytes, iv, wrapAad);
}

/** Desembrulha a DEK — LANÇA se a chave (senha/código) ou a AAD não conferem. */
export function unwrapDek(
  wrappingKey: CryptoKey,
  wrapped: Uint8Array,
  iv: Uint8Array,
  wrapAad: Uint8Array,
): Promise<Uint8Array> {
  return aeadDecrypt(wrappingKey, wrapped, iv, wrapAad);
}
