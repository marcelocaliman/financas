import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { db } from "@/data/db";
import {
  createVault as cryptoCreateVault,
  rewrapPassword,
  rewrapPasswordFromRecovery,
  rotateRecoveryCode,
  unlockWithPassword as cryptoUnlockPw,
  unlockWithRecoveryCode as cryptoUnlockCode,
  type VaultKeys,
  type VaultMeta,
} from "@/crypto/envelope";
import {
  createServerVault,
  deleteAccountServer,
  fetchVaultMeta,
  pullVault,
  pushVault,
  rewrapPasswordServer,
  rewrapRecoveryServer,
} from "./sync";
import { dumpVault, loadVault } from "./serialize";
import { pending } from "./pending";
import { sessionKeys } from "./session-keys";
import { saveConflictBackup } from "./conflict-backup";

type Status = "loading" | "signedOut" | "locked" | "unlocked";

async function clearLocalDb(): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}

interface VaultStore {
  status: Status;
  userId: string | null;
  email: string | null;
  keys: VaultKeys | null; // dek + authTag — SOMENTE em memória, nunca persiste
  meta: VaultMeta | null;
  version: number;
  recoveryCodeOnce: string | null; // mostrado UMA vez após o cadastro
  syncing: boolean;

  init: () => Promise<void>;
  signUp: (email: string, password: string, captchaToken?: string | null) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string, captchaToken?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  unlock: (password: string) => Promise<void>;
  unlockWithRecovery: (code: string) => Promise<void>;
  recoverAndReset: (code: string, newPassword: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  rotateRecovery: (password: string) => Promise<string>;
  deleteAccount: () => Promise<void>;
  push: () => Promise<void>;
  dismissRecoveryCode: () => void;
  lock: () => void;
}

export const useVault = create<VaultStore>((set, get) => {
  // Serializa os pushes: mutações rápidas não competem pela versão do cofre
  // (evita version_conflict + clobber que ressuscitaria itens excluídos).
  let pushChain: Promise<void> = Promise.resolve();
  let onlineHooked = false;

  /** Pós-unlock: traz o cofre do servidor (ou sobe um cofre novo, vazio). */
  async function syncAfterUnlock(keys: VaultKeys, meta: VaultMeta, version: number): Promise<void> {
    void sessionKeys.save(meta.userId, keys); // mantém destravado entre reloads
    if (version > 0) {
      if (pending.has()) {
        // Há mutações locais possivelmente NÃO sincronizadas → não sobrescrever
        // o local com o servidor; subir primeiro (CAS). Preserva o trabalho feito
        // offline (durabilidade local-first).
        await get().push();
      } else {
        const data = await pullVault(keys, meta.userId, version);
        if (data) await loadVault(db, data);
        set({ version });
      }
    } else {
      // Cofre novo nasce VAZIO — limpa qualquer resíduo local (evita capturar
      // dados de outra conta no mesmo navegador) e sobe um blob vazio na v1.
      // Os dados de exemplo são opt-in pela Config.
      await clearLocalDb();
      const data = await dumpVault(db);
      const newVersion = await pushVault(keys, meta.userId, 0, data);
      pending.clear();
      set({ version: newVersion });
    }
  }

  return {
    status: "loading",
    userId: null,
    email: null,
    keys: null,
    meta: null,
    version: 0,
    recoveryCodeOnce: null,
    syncing: false,

    async init() {
      if (!onlineHooked && typeof window !== "undefined") {
        onlineHooked = true;
        // Voltou a conexão e há push pendente → re-tenta subir.
        window.addEventListener("online", () => {
          if (pending.has() && get().status === "unlocked") void get().push();
        });
      }
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        set({ status: "signedOut" });
        return;
      }
      const server = await fetchVaultMeta(user.id);
      if (!server) {
        // Sessão sem cofre (confirmou e-mail mas não completou o setup) → força
        // novo login pra capturar a senha e criar o cofre com a senha certa.
        await supabase.auth.signOut();
        set({ status: "signedOut", userId: null, email: null });
        return;
      }
      const restored = await sessionKeys.load(user.id);
      if (restored) {
        // Já destravado nesta sessão do navegador → pula a tela de senha no reload.
        set({
          status: "unlocked",
          userId: user.id,
          email: user.email ?? null,
          keys: restored,
          meta: server.meta,
          version: server.version,
        });
        try {
          await syncAfterUnlock(restored, server.meta, server.version);
        } catch {
          /* sync falhou (offline) — segue destravado com os dados locais */
        }
        return;
      }
      set({
        status: "locked",
        userId: user.id,
        email: user.email ?? null,
        meta: server.meta,
        version: server.version,
      });
    },

    async signUp(email, password, captchaToken) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: captchaToken ? { captchaToken } : undefined });
      if (error) throw error;
      if (!data.session) return { needsConfirmation: true };
      // Confirmação de e-mail desligada → já tem sessão; cria o cofre agora.
      const userId = data.user!.id;
      const nv = await cryptoCreateVault(userId, password);
      await createServerVault(nv);
      set({
        status: "unlocked",
        userId,
        email: data.user?.email ?? email,
        keys: { dek: nv.dek, authTag: nv.authTag },
        meta: nv,
        version: 0,
        recoveryCodeOnce: nv.recoveryCode,
      });
      await syncAfterUnlock({ dek: nv.dek, authTag: nv.authTag }, nv, 0);
      return { needsConfirmation: false };
    },

    async signIn(email, password, captchaToken) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined });
      if (error) throw error;
      const user = data.user;
      const server = await fetchVaultMeta(user.id);
      if (!server) {
        // Primeiro login após confirmar e-mail → cria o cofre com esta senha.
        const nv = await cryptoCreateVault(user.id, password);
        await createServerVault(nv);
        set({
          status: "unlocked",
          userId: user.id,
          email: user.email ?? email,
          keys: { dek: nv.dek, authTag: nv.authTag },
          meta: nv,
          version: 0,
          recoveryCodeOnce: nv.recoveryCode,
        });
        await syncAfterUnlock({ dek: nv.dek, authTag: nv.authTag }, nv, 0);
        return;
      }
      const keys = await cryptoUnlockPw(server.meta, password); // LANÇA se a senha não bate
      set({
        status: "unlocked",
        userId: user.id,
        email: user.email ?? email,
        keys,
        meta: server.meta,
        version: server.version,
      });
      await syncAfterUnlock(keys, server.meta, server.version);
    },

    async signOut() {
      // Tenta subir o que estiver pendente ANTES de limpar (não perder offline).
      if (pending.has() && get().keys) {
        try {
          await get().push();
        } catch {
          /* offline/erro — segue com o logout mesmo assim */
        }
      }
      await supabase.auth.signOut();
      // Limpa o Dexie local: evita que a próxima conta no mesmo navegador capture
      // dados residuais desta. O dado durável vive cifrado no servidor.
      await clearLocalDb();
      pending.clear();
      await sessionKeys.clear();
      set({ status: "signedOut", userId: null, email: null, keys: null, meta: null, version: 0 });
    },

    async unlock(password) {
      const { meta } = get();
      if (!meta) throw new Error("cofre não carregado");
      const keys = await cryptoUnlockPw(meta, password); // LANÇA OperationError se a senha não bate
      set({ status: "unlocked", keys });
      try {
        await syncAfterUnlock(keys, meta, get().version);
      } catch {
        /* senha certa — sync falhou (rede/glitch); segue destravado com os dados locais */
      }
    },

    async unlockWithRecovery(code) {
      const { meta } = get();
      if (!meta) throw new Error("cofre não carregado");
      const keys = await cryptoUnlockCode(meta, code);
      set({ status: "unlocked", keys });
      try {
        await syncAfterUnlock(keys, meta, get().version);
      } catch {
        /* código certo — sync falhou; segue destravado com os dados locais */
      }
    },

    async recoverAndReset(code, newPassword) {
      const { meta } = get();
      if (!meta) throw new Error("cofre não carregado");
      const rw = await rewrapPasswordFromRecovery(meta, code, newPassword);
      await rewrapPasswordServer(rw);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const newMeta: VaultMeta = {
        ...meta,
        salt: rw.salt,
        kdfParams: rw.kdfParams,
        wrappedDekPw: rw.wrappedDekPw,
        wrappedDekPwIv: rw.wrappedDekPwIv,
      };
      const keys = await cryptoUnlockPw(newMeta, newPassword);
      set({ status: "unlocked", keys, meta: newMeta });
      await syncAfterUnlock(keys, newMeta, get().version);
    },

    async changePassword(current, next) {
      const { meta } = get();
      if (!meta) throw new Error("cofre não carregado");
      const rw = await rewrapPassword(meta, current, next); // self-test embutido
      await rewrapPasswordServer(rw); // persiste o novo embrulho
      const { error } = await supabase.auth.updateUser({ password: next }); // só depois
      if (error) throw error;
      set({
        meta: {
          ...meta,
          salt: rw.salt,
          kdfParams: rw.kdfParams,
          wrappedDekPw: rw.wrappedDekPw,
          wrappedDekPwIv: rw.wrappedDekPwIv,
        },
      });
    },

    async rotateRecovery(password) {
      const { meta } = get();
      if (!meta) throw new Error("cofre não carregado");
      const rot = await rotateRecoveryCode(meta, password);
      await rewrapRecoveryServer(rot);
      set({
        meta: {
          ...meta,
          saltRecovery: rot.saltRecovery,
          wrappedDekRecovery: rot.wrappedDekRecovery,
          wrappedDekRecoveryIv: rot.wrappedDekRecoveryIv,
        },
        recoveryCodeOnce: rot.recoveryCode, // mostra o novo código no diálogo
      });
      return rot.recoveryCode;
    },

    async deleteAccount() {
      await deleteAccountServer();
      await supabase.auth.signOut();
      await clearLocalDb();
      pending.clear();
      await sessionKeys.clear();
      set({ status: "signedOut", userId: null, email: null, keys: null, meta: null, version: 0 });
    },

    push() {
      const run = async (): Promise<void> => {
        const { keys, userId, version } = get(); // versão fresca a cada execução
        if (!keys || !userId) return; // cofre trancado → nunca escreve
        set({ syncing: true });
        let ok = false;
        try {
          const data = await dumpVault(db);
          try {
            const v = await pushVault(keys, userId, version, data);
            set({ version: v });
            ok = true;
          } catch (e) {
            // conflito de versão (outro dispositivo) → puxa, reaplica, re-sobe
            if (e instanceof Error && /version_conflict/.test(e.message)) {
              const server = await fetchVaultMeta(userId);
              if (server) {
                const remote = await pullVault(keys, userId, server.version);
                if (remote) {
                  // ADOTAR o remoto descarta as mudanças locais que não subiram (loadVault
                  // zera as tabelas). Sem timestamp por registro não dá pra fazer merge de
                  // 3 vias com honestidade — então NUNCA descartamos em silêncio: o estado
                  // local vai pra uma cópia de conflito (baixável/re-importável) e o Painel avisa.
                  saveConflictBackup(data);
                  await loadVault(db, remote);
                }
                const merged = await dumpVault(db);
                const v = await pushVault(keys, userId, server.version, merged);
                set({ version: v });
                ok = true;
              }
            } else {
              throw e;
            }
          }
        } finally {
          set({ syncing: false });
          if (ok) pending.clear(); // sincronizado → não há mais pendência
        }
      };
      // Encadeia: o próximo push só roda quando o anterior terminar, já com a
      // versão atualizada — uma mutação não atropela a outra.
      const next = pushChain.then(run, run);
      pushChain = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },

    dismissRecoveryCode() {
      set({ recoveryCodeOnce: null });
    },

    lock() {
      void sessionKeys.clear(); // exige a senha no próximo reload
      set({ status: "locked", keys: null });
    },
  };
});
