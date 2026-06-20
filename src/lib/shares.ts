import { supabase } from "@/lib/supabase";
import { aeadDecrypt, aeadEncrypt, randomBytes } from "@/crypto/aead";
import { aad, utf8 } from "@/crypto/bytes";
import { unlockWithShare, wrapDekForShare, type VaultMeta } from "@/crypto/envelope";
import { decryptVault, type VaultData } from "@/vault/blob";

/**
 * Acesso da família (só-leitura). O DONO cria um link `…/share#s=<token>:<segredo>` + um
 * PIN de 4 dígitos. O segredo (no fragmento) re-embrulha a DEK; o servidor só guarda o
 * material cifrado. O viewer (esposa) chama `share_open` (anon, com lockout no RPC),
 * desembrulha a DEK e decifra — tudo no cliente. Nada de texto claro/segredo no servidor.
 */

const AAD_INFO = "share-secret-v1";

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
/** base64 padrão (a RPC share_open usa encode(...,'base64'), que insere quebras de linha). */
function fromB64(s: string): Uint8Array {
  const bin = atob(s.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** PIN de 4 dígitos uniforme (rejeição p/ não ter viés de módulo). */
function randomDigit(): number {
  const b = new Uint8Array(1);
  do crypto.getRandomValues(b);
  while (b[0] >= 250);
  return b[0] % 10;
}
function gen4Pin(): string {
  return [0, 0, 0, 0].map(randomDigit).join("");
}
/** Token-capability: 24 bytes (192 bits) em hex. */
function genToken(): string {
  return Array.from(randomBytes(24), (b) => b.toString(16).padStart(2, "0")).join("");
}
/** O idioma do DONO viaja no fragmento (`&l=`) → o viewer renderiza no MESMO idioma do
 *  app do dono (não no do navegador da esposa). Não é sensível e fica fora do servidor. */
function shareLink(token: string, secret: string, lang?: string): string {
  const base = `${location.origin}/share#s=${token}:${secret}`;
  return lang ? `${base}&l=${lang}` : base;
}

export interface ShareRow {
  id: string;
  token: string;
  label: string | null;
  createdAt: string;
  accessedAt: string | null;
  secret: string; // decifrado — só pra reexibir
  pin: string;
  lang?: string; // idioma do dono na criação (pt/en)
  link: string;
}

/**
 * Cria um acesso. Exige a SENHA (re-auth → desembrulha a DEK pra re-embrulhar sob o segredo).
 * Guarda {segredo,pin} cifrado pela DEK (`secret_enc`) só pra reexibição do dono.
 */
export async function createShare(
  meta: VaultMeta,
  dek: CryptoKey,
  userId: string,
  password: string,
  label: string,
  lang: string,
): Promise<ShareRow> {
  const { secret, saltShare, wrappedDekShare, wrappedDekShareIv } = await wrapDekForShare(meta, password);
  const pin = gen4Pin();
  const token = genToken();
  // IV do secret_enc: aleatório com o BIT MAIS ALTO setado → domínio disjunto dos IVs-contador
  // da DEK (que têm byte alto 0 p/ qualquer contador realista) → impossível colidir.
  const iv = randomBytes(12);
  iv[0] |= 0x80;
  // `lang` no secret_enc → o dono reconstrói o link COM o idioma ao reexibir na Config.
  const secretEnc = await aeadEncrypt(dek, utf8(JSON.stringify({ secret, pin, lang })), iv, aad(userId, AAD_INFO, token));
  const { data, error } = await supabase.rpc("create_vault_share", {
    p_token: token,
    p_pin: pin,
    p_salt_share: toHex(saltShare),
    p_wrapped: toHex(wrappedDekShare),
    p_wrapped_iv: toHex(wrappedDekShareIv),
    p_secret_enc: toHex(secretEnc),
    p_secret_iv: toHex(iv),
    p_label: label,
  });
  if (error) throw error;
  return {
    id: String(data),
    token,
    label: label || null,
    createdAt: new Date().toISOString(),
    accessedAt: null,
    secret,
    pin,
    lang,
    link: shareLink(token, secret, lang),
  };
}

/** Lista os acessos do dono (RLS) e decifra o segredo/pin de cada um pra reexibir. */
export async function listShares(dek: CryptoKey, userId: string): Promise<ShareRow[]> {
  const { data, error } = await supabase
    .from("vault_shares")
    .select("id, token, label, created_at, accessed_at, secret_enc, secret_iv")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const out: ShareRow[] = [];
  for (const r of (data ?? []) as Record<string, string>[]) {
    try {
      const pt = await aeadDecrypt(dek, fromHex(r.secret_enc), fromHex(r.secret_iv), aad(userId, AAD_INFO, r.token));
      const { secret, pin, lang } = JSON.parse(new TextDecoder().decode(pt)) as { secret: string; pin: string; lang?: string };
      out.push({
        id: r.id,
        token: r.token,
        label: r.label ?? null,
        createdAt: r.created_at,
        accessedAt: r.accessed_at ?? null,
        secret,
        pin,
        lang,
        link: shareLink(r.token, secret, lang),
      });
    } catch {
      /* linha ilegível (DEK diferente?) — ignora */
    }
  }
  return out;
}

export async function revokeShare(id: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_vault_share", { p_id: id });
  if (error) throw error;
}

/** Quantos acessos o dono tem (KPI da Config). Só conta — não precisa decifrar nada. */
export async function countShares(): Promise<number> {
  const { count, error } = await supabase
    .from("vault_shares")
    .select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

/* ── VIEWER (esposa, sem conta) ─────────────────────────────────────────────── */

export type ShareOpenResult =
  | { ok: true; data: VaultData; ownerId: string; version: number }
  | { ok: false; error: "not_found" | "pin" | "locked" | "empty" | "error"; retryAfter?: number };

/** Lê o link, parseia o fragmento `#s=<token>:<segredo>[&l=<idioma>]`. */
export function parseShareFragment(): { token: string; secret: string; lang?: string } | null {
  const h = (location.hash || "").replace(/^#/, "");
  const m = /(?:^|&)s=([^&]+)/.exec(h);
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  const i = raw.indexOf(":");
  if (i < 0) return null;
  const token = raw.slice(0, i);
  const secret = raw.slice(i + 1);
  if (!token || !secret) return null;
  const lm = /(?:^|&)l=([a-z]{2})/.exec(h);
  return { token, secret, lang: lm ? lm[1] : undefined };
}

/** Abre o acesso (anon): verifica o PIN no servidor (lockout) e, se ok, decifra o cofre. */
export async function openShare(token: string, secret: string, pin: string): Promise<ShareOpenResult> {
  const { data, error } = await supabase.rpc("share_open", { p_token: token, p_pin: pin });
  if (error) return { ok: false, error: "error" };
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok !== true) {
    const e = String(r.error || "error") as Exclude<ShareOpenResult, { ok: true }>["error"];
    const retryAfter = typeof r.retry_after === "number" ? r.retry_after : undefined;
    return { ok: false, error: e, retryAfter };
  }
  try {
    const ownerId = String(r.owner_id);
    const version = Number(r.vault_version);
    const keys = await unlockWithShare(
      {
        userId: ownerId,
        saltShare: fromB64(String(r.salt_share)),
        wrappedDekShare: fromB64(String(r.wrapped_dek_share)),
        wrappedDekShareIv: fromB64(String(r.wrapped_dek_share_iv)),
      },
      secret,
    );
    const vault = await decryptVault(keys.dek, ownerId, version, fromB64(String(r.iv)), fromB64(String(r.ciphertext)));
    return { ok: true, data: vault, ownerId, version };
  } catch {
    return { ok: false, error: "error" }; // segredo errado / blob adulterado
  }
}
