import { describe, it, expect } from "vitest";
import { decryptVault, encryptVault, type VaultData } from "./blob";
import { generateDek, importVaultKey } from "@/crypto/keys";

const dek = () => importVaultKey(generateDek());
const USER = "user-1";
const sample: VaultData = {
  assets: [{ id: "a1", name: "Tesouro", currency: "BRL", amount: 1000 }],
  expenses: [],
};

describe("blob do cofre — cifra/decifra o cofre inteiro", () => {
  it("round-trip na mesma versão preserva os dados", async () => {
    const k = await dek();
    const { ciphertext, iv } = await encryptVault(k, USER, 5, sample);
    expect(await decryptVault(k, USER, 5, iv, ciphertext)).toEqual(sample);
  });

  it("versão errada → decifra LANÇA (AAD amarra à versão)", async () => {
    const k = await dek();
    const { ciphertext, iv } = await encryptVault(k, USER, 5, sample);
    await expect(decryptVault(k, USER, 6, iv, ciphertext)).rejects.toThrow();
  });

  it("usuário errado → LANÇA (anti-substituição entre usuários)", async () => {
    const k = await dek();
    const { ciphertext, iv } = await encryptVault(k, USER, 5, sample);
    await expect(decryptVault(k, "outro-user", 5, iv, ciphertext)).rejects.toThrow();
  });

  it("DEK errada → LANÇA", async () => {
    const k1 = await dek();
    const k2 = await dek();
    const { ciphertext, iv } = await encryptVault(k1, USER, 5, sample);
    await expect(decryptVault(k2, USER, 5, iv, ciphertext)).rejects.toThrow();
  });
});
