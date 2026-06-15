import { aeadDecrypt, aeadEncrypt, ivFromCounter } from "@/crypto/aead";
import { aad, u64be, utf8 } from "@/crypto/bytes";

/** Conteúdo serializável do cofre (dump de todas as tabelas locais). */
export type VaultData = Record<string, unknown[]>;

const SHARD = "main";
const decoder = new TextDecoder();

/**
 * Cifra o cofre INTEIRO num blob, para uma vault_version específica.
 * O IV vem da versão (contador monotônico — nunca reusa) e a AAD amarra o
 * ciphertext a (usuário, shard, versão): um blob decifrado na versão errada,
 * por outro usuário, ou substituído pelo servidor, FALHA a tag.
 */
export async function encryptVault(
  dek: CryptoKey,
  userId: string,
  version: number,
  vault: VaultData,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = ivFromCounter(BigInt(version));
  const ad = aad(userId, SHARD, u64be(version));
  const ciphertext = await aeadEncrypt(dek, utf8(JSON.stringify(vault)), iv, ad);
  return { ciphertext, iv };
}

/** Decifra um blob. LANÇA se DEK/usuário/versão não conferem (tag inválida). */
export async function decryptVault(
  dek: CryptoKey,
  userId: string,
  version: number,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<VaultData> {
  const ad = aad(userId, SHARD, u64be(version));
  const plaintext = await aeadDecrypt(dek, ciphertext, iv, ad);
  return JSON.parse(decoder.decode(plaintext)) as VaultData;
}
