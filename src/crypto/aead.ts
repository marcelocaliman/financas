/**
 * AES-256-GCM nativo (WebCrypto). AAD SEMPRE obrigatória (não é opcional) — toda
 * cifragem amarra o ciphertext ao seu contexto (usuário, papel, versão), o que
 * impede substituição/replay/downgrade por um servidor malicioso.
 *
 * NUNCA implementamos cripto na mão — só orquestramos primitivas nativas auditadas.
 */

import { ab } from "./bytes";

const TAG_LENGTH = 128;

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/**
 * Importa 32 bytes como chave AES-GCM. `extractable=false` por padrão: a chave
 * não pode ser lida de volta pra heap do JS (defesa contra XSS).
 */
export function importAesKey(raw: Uint8Array, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", ab(raw), { name: "AES-GCM" }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * IV de 96 bits a partir de um contador monotônico. Para uma chave de vida longa
 * (a DEK do cofre), o IV NUNCA pode repetir — colisão sob GCM é catastrófica.
 * Usar contador persistido (não aleatório) elimina o risco de aniversário.
 */
export function ivFromCounter(counter: bigint): Uint8Array {
  if (counter < 0n || counter >= 1n << 96n) {
    throw new Error("contador de IV fora do intervalo de 96 bits");
  }
  const iv = new Uint8Array(12);
  let c = counter;
  for (let i = 11; i >= 0; i--) {
    iv[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  return iv;
}

/** Cifra com AAD obrigatória. Retorna ciphertext concatenado com a tag (128 bits). */
export async function aeadEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  iv: Uint8Array,
  additionalData: Uint8Array,
): Promise<Uint8Array> {
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ab(iv), additionalData: ab(additionalData), tagLength: TAG_LENGTH },
    key,
    ab(plaintext),
  );
  return new Uint8Array(ct);
}

/** Decifra; LANÇA se a tag ou a AAD não conferem (senha errada, tampering, versão errada). */
export async function aeadDecrypt(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  additionalData: Uint8Array,
): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ab(iv), additionalData: ab(additionalData), tagLength: TAG_LENGTH },
    key,
    ab(ciphertext),
  );
  return new Uint8Array(pt);
}
