import { repository } from "@/data/dexie-repository";
import { SEED } from "@/data/seed";
import { useVault } from "@/vault/vault-store";
import { pending } from "@/vault/pending";
import type { Asset, Liability } from "@/domain/types";

/**
 * Mutações do app. Escrevem PRIMEIRO no repositório local (instantâneo, offline),
 * MARCAM pendência de sync e disparam o push cifrado em segundo plano. Se a rede
 * falhar, o dado já está salvo localmente e a flag garante que o próximo
 * unlock/online re-tente subir — sem nunca sobrescrever o local com o servidor.
 */
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Coalesce: edições rápidas (grid) viram UM push, não um por célula. */
function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void useVault
      .getState()
      .push()
      .catch((e) => console.warn("sync adiado (será re-tentado):", e));
  }, 700);
}

async function withSync(write: () => Promise<void>): Promise<void> {
  await write();
  pending.set(); // durabilidade: marcado já; o push é re-tentado no unlock/online
  schedulePush();
}

export const actions = {
  putAsset: (asset: Asset) => withSync(() => repository.putAsset(asset)),
  removeAsset: (id: string) => withSync(() => repository.removeAsset(id)),
  putLiability: (liability: Liability) => withSync(() => repository.putLiability(liability)),
  removeLiability: (id: string) => withSync(() => repository.removeLiability(id)),
  /** Carrega os dados de exemplo (opt-in pela Config). */
  loadSample: () => withSync(() => repository.seed(SEED)),
  /** Apaga tudo — "começar do zero". */
  resetAll: () => withSync(() => repository.clearAll()),
};
