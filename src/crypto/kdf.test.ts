import { describe, it, expect } from "vitest";
import {
  assertKdfFloor,
  canonicalKdf,
  DEFAULT_KDF,
  deriveArgon2id,
  KDF_FLOOR,
  type KdfParams,
} from "./kdf";

const FAST: KdfParams = { algo: "argon2id", m: KDF_FLOOR.m, t: KDF_FLOOR.t, p: 1, v: 0x13 };
const salt = new Uint8Array(16).fill(7);

describe("deriveArgon2id", () => {
  it("é determinístico e retorna 32 bytes", async () => {
    const a = await deriveArgon2id("senha-correta", salt, FAST);
    const b = await deriveArgon2id("senha-correta", salt, FAST);
    expect(a.length).toBe(32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("salt diferente → saída diferente", async () => {
    const a = await deriveArgon2id("s", salt, FAST);
    const b = await deriveArgon2id("s", new Uint8Array(16).fill(9), FAST);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("senha diferente → saída diferente", async () => {
    const a = await deriveArgon2id("s1", salt, FAST);
    const b = await deriveArgon2id("s2", salt, FAST);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe("piso de força (anti-downgrade)", () => {
  it("aceita o padrão e o piso", () => {
    expect(() => assertKdfFloor(DEFAULT_KDF)).not.toThrow();
    expect(() => assertKdfFloor(FAST)).not.toThrow();
  });
  it("recusa memória abaixo do piso", () => {
    expect(() => assertKdfFloor({ ...FAST, m: 1024 })).toThrow();
  });
  it("recusa iterações abaixo do piso e versão errada", () => {
    expect(() => assertKdfFloor({ ...FAST, t: 1 })).toThrow();
    expect(() => assertKdfFloor({ ...FAST, v: 0x10 })).toThrow();
  });
  it("deriveArgon2id também recusa abaixo do piso", async () => {
    await expect(deriveArgon2id("s", salt, { ...FAST, m: 1024 })).rejects.toThrow();
  });
});

describe("canonicalKdf", () => {
  it("formato estável (entra na AAD)", () => {
    expect(canonicalKdf(DEFAULT_KDF)).toBe("argon2id:m=65536,t=3,p=1,v=19");
  });
});
