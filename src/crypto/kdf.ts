import { argon2id } from "hash-wasm";

/**
 * KDF da SENHA: Argon2id (memory-hard) via hash-wasm (lib auditada).
 * A constituição exige KDF forte. O cliente IMPÕE um piso de força — o servidor
 * não escolhe parâmetros fracos pra enfraquecer a derivação (downgrade).
 */

export interface KdfParams {
  algo: "argon2id";
  m: number; // memória em KiB
  t: number; // iterações
  p: number; // paralelismo
  v: number; // versão do Argon2 (0x13)
}

export const ARGON2_VERSION = 0x13;

/** Piso mínimo aceito pelo cliente (recomendação OWASP: 19 MiB, t≥2). */
export const KDF_FLOOR = { m: 19_456, t: 2, v: ARGON2_VERSION } as const; // 19 MiB

/** Padrão para novos cofres: 64 MiB. Força previsível (sem calibração adaptativa na V1). */
export const DEFAULT_KDF: KdfParams = {
  algo: "argon2id",
  m: 65_536, // 64 MiB
  t: 3,
  p: 1,
  v: ARGON2_VERSION,
};

/** Recusa parâmetros abaixo do piso — independentemente do que o servidor envie. */
export function assertKdfFloor(params: KdfParams): void {
  if (params.algo !== "argon2id") throw new Error("KDF não suportado");
  if (params.v !== ARGON2_VERSION) throw new Error("versão Argon2 inválida");
  if (params.m < KDF_FLOOR.m) {
    throw new Error(`memória do KDF abaixo do piso (${params.m} < ${KDF_FLOOR.m} KiB)`);
  }
  if (params.t < KDF_FLOOR.t) throw new Error("iterações do KDF abaixo do piso");
  if (params.p < 1) throw new Error("paralelismo inválido");
}

/** Deriva 32 bytes da senha. Salt deve ter ≥ 16 bytes e ser único por cofre. */
export async function deriveArgon2id(
  password: string,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  assertKdfFloor(params);
  return argon2id({
    password,
    salt,
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m, // KiB
    hashLength: 32,
    outputType: "binary",
  });
}

/** Forma canônica dos parâmetros — entra na AAD do embrulho da senha (anti-downgrade). */
export function canonicalKdf(params: KdfParams): string {
  return `argon2id:m=${params.m},t=${params.t},p=${params.p},v=${params.v}`;
}
