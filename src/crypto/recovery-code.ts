import { randomBytes } from "./aead";

/**
 * Código de recuperação: 128 bits ALEATÓRIOS (nunca derivado da senha — senão
 * phishar a senha bastaria). Codificado em Base32 Crockford (sem I L O U, sem
 * confusão visual), agrupado em blocos de 5. Mostrado UMA vez no cadastro.
 *
 * Como tem entropia plena (128 bits), NÃO passa por Argon2id — só HKDF direto na
 * derivação da RWK (rápido, e funciona mesmo se o WASM do Argon2 não carregar).
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford
export const RECOVERY_BYTES = 16; // 128 bits

const DECODE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) m[ALPHABET[i]] = i;
  // confusáveis → mapeiam pro dígito equivalente
  m["O"] = 0;
  m["I"] = 1;
  m["L"] = 1;
  return m;
})();

function encodeBase32(bytes: Uint8Array): string {
  let buffer = 0;
  let bits = 0;
  let out = "";
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
    buffer &= (1 << bits) - 1; // descarta os bits já consumidos (evita overflow 32-bit)
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

function decodeBase32(s: string): Uint8Array {
  let buffer = 0;
  let bits = 0;
  const out: number[] = [];
  for (const ch of s) {
    const v = DECODE[ch];
    if (v === undefined) throw new Error(`caractere inválido no código de recuperação: "${ch}"`);
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return new Uint8Array(out);
}

/** Gera um novo código + os bytes correspondentes (os bytes alimentam a RWK). */
export function generateRecoveryCode(): { code: string; bytes: Uint8Array } {
  const bytes = randomBytes(RECOVERY_BYTES);
  const groups = encodeBase32(bytes).match(/.{1,5}/g);
  return { code: (groups ?? []).join("-"), bytes };
}

/** Normaliza (maiúsculas, sem hífen/espaço, confusáveis) e decodifica pra 16 bytes. */
export function parseRecoveryCode(code: string): Uint8Array {
  const norm = code.toUpperCase().replace(/[\s-]/g, "");
  if (norm.length === 0) throw new Error("código de recuperação vazio");
  const bytes = decodeBase32(norm);
  if (bytes.length < RECOVERY_BYTES) throw new Error("código de recuperação incompleto");
  return bytes.slice(0, RECOVERY_BYTES);
}
