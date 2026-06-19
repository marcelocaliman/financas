/** Utilitários de bytes. Sem cripto aqui — só manipulação determinística. */

const TE = new TextEncoder();

export function utf8(s: string): Uint8Array {
  return TE.encode(s);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Inteiro de 64 bits big-endian (ex.: vault_version na AAD do blob). */
export function u64be(n: number | bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(n), false);
  return out;
}

/**
 * Constrói uma AAD (dado autenticado adicional) canônica: cada parte é
 * prefixada por 4 bytes de tamanho (big-endian). Isso elimina ambiguidade de
 * concatenação — "ab"+"c" nunca colide com "a"+"bc".
 */
export function aad(...parts: (Uint8Array | string)[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (const p of parts) {
    const b = typeof p === "string" ? TE.encode(p) : p;
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, b.length, false);
    chunks.push(len, b);
  }
  return concat(...chunks);
}

/** Base64url (URL-safe, sem padding) — usado pra carregar o segredo de share no fragmento da URL. */
export function toBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(str: string): Uint8Array {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Comparação em tempo constante (evita timing oracle). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Zera um buffer sensível (best-effort — não há garantia forte em JS). */
export function wipe(b: Uint8Array): void {
  b.fill(0);
}

/**
 * TS 5.7+ tornou `Uint8Array` genérico (`Uint8Array<ArrayBufferLike>`), mas a
 * WebCrypto exige views sobre `ArrayBuffer`. Em runtime TODOS os nossos buffers
 * são ArrayBuffer (nunca SharedArrayBuffer) — cast localizado e seguro nos limites.
 */
export function ab(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}
