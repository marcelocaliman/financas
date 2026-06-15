import { supabase } from "@/lib/supabase";
import type { NewVault, VaultKeys, VaultMeta } from "@/crypto/envelope";
import type { KdfParams } from "@/crypto/kdf";
import { decryptVault, encryptVault, type VaultData } from "./blob";

/**
 * Orquestração do sync cifrado contra o Supabase. Tudo que sobe é CIPHERTEXT.
 * bytea trafega como hex "\\x..." (formato do PostgREST).
 */

const SHARD = "main";

function toHex(u8: Uint8Array): string {
  let s = "\\x";
  for (const b of u8) s += b.toString(16).padStart(2, "0");
  return s;
}

function fromHex(s: string): Uint8Array {
  const h = s.startsWith("\\x") ? s.slice(2) : s;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export interface ServerVault {
  meta: VaultMeta;
  version: number;
}

/** Lê a linha do cofre do usuário (ou null se ainda não existe). */
export async function fetchVaultMeta(userId: string): Promise<ServerVault | null> {
  const { data, error } = await supabase
    .from("vaults")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, string>;
  return {
    version: Number(row.vault_version),
    meta: {
      userId,
      kdfParams: row.kdf_params as unknown as KdfParams,
      salt: fromHex(row.salt),
      saltRecovery: fromHex(row.salt_recovery),
      wrappedDekPw: fromHex(row.wrapped_dek_pw),
      wrappedDekPwIv: fromHex(row.wrapped_dek_pw_iv),
      wrappedDekRecovery: fromHex(row.wrapped_dek_recovery),
      wrappedDekRecoveryIv: fromHex(row.wrapped_dek_recovery_iv),
    },
  };
}

/** Cria a linha do cofre (INSERT, permitido por RLS) + planta a prova de posse. */
export async function createServerVault(v: NewVault): Promise<void> {
  const { error } = await supabase.from("vaults").insert({
    user_id: v.userId,
    kdf: "argon2id",
    kdf_params: v.kdfParams,
    salt: toHex(v.salt),
    salt_recovery: toHex(v.saltRecovery),
    wrapped_dek_pw: toHex(v.wrappedDekPw),
    wrapped_dek_pw_iv: toHex(v.wrappedDekPwIv),
    wrapped_dek_recovery: toHex(v.wrappedDekRecovery),
    wrapped_dek_recovery_iv: toHex(v.wrappedDekRecoveryIv),
  } as never);
  if (error) throw error;
  const { error: e2 } = await supabase.rpc("set_vault_auth", { p_auth_tag: toHex(v.authTag) });
  if (e2) throw e2;
}

/** PULL: baixa o blob, decifra e retorna os dados (null se cofre ainda vazio). */
export async function pullVault(
  keys: VaultKeys,
  userId: string,
  version: number,
): Promise<VaultData | null> {
  if (version === 0) return null;
  const { data, error } = await supabase
    .from("vault_blobs")
    .select("vault_version, ciphertext, iv")
    .eq("user_id", userId)
    .eq("shard", SHARD)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, string>;
  return decryptVault(
    keys.dek,
    userId,
    Number(row.vault_version),
    fromHex(row.iv),
    fromHex(row.ciphertext),
  );
}

/** PUSH: cifra os dados na próxima versão e grava com compare-and-swap. */
export async function pushVault(
  keys: VaultKeys,
  userId: string,
  expectedVersion: number,
  data: VaultData,
): Promise<number> {
  const newVersion = expectedVersion + 1;
  const { ciphertext, iv } = await encryptVault(keys.dek, userId, newVersion, data);
  const { data: res, error } = await supabase.rpc("push_vault", {
    p_expected_version: expectedVersion,
    p_ciphertext: toHex(ciphertext),
    p_iv: toHex(iv),
    p_auth_tag: toHex(keys.authTag),
    p_shard: SHARD,
  });
  if (error) throw error;
  return Number(res);
}

export async function rewrapPasswordServer(rw: {
  salt: Uint8Array;
  kdfParams: KdfParams;
  wrappedDekPw: Uint8Array;
  wrappedDekPwIv: Uint8Array;
}): Promise<void> {
  const { error } = await supabase.rpc("rewrap_password", {
    p_salt: toHex(rw.salt),
    p_kdf_params: rw.kdfParams,
    p_wrapped: toHex(rw.wrappedDekPw),
    p_iv: toHex(rw.wrappedDekPwIv),
  });
  if (error) throw error;
}

export async function rewrapRecoveryServer(rw: {
  saltRecovery: Uint8Array;
  wrappedDekRecovery: Uint8Array;
  wrappedDekRecoveryIv: Uint8Array;
}): Promise<void> {
  const { error } = await supabase.rpc("rewrap_recovery", {
    p_salt_recovery: toHex(rw.saltRecovery),
    p_wrapped: toHex(rw.wrappedDekRecovery),
    p_iv: toHex(rw.wrappedDekRecoveryIv),
  });
  if (error) throw error;
}

export async function deleteAccountServer(): Promise<void> {
  const { error } = await supabase.rpc("delete_account");
  if (error) throw error;
}
