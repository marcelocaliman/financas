import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { db } from "@/data/db";
import { SEED } from "@/data/seed";
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

type Status = "loading" | "signedOut" | "locked" | "unlocked";

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
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
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

async function seedIfEmpty(): Promise<void> {
  if ((await db.assets.count()) === 0) {
    await db.transaction("rw", db.tables, async () => {
      await db.assets.bulkPut(SEED.assets);
      await db.expenses.bulkPut(SEED.expenses);
      await db.incomes.bulkPut(SEED.incomes);
      await db.netWorthSnapshots.bulkPut(SEED.snapshots);
    });
  }
}

export const useVault = create<VaultStore>((set, get) => {
  /** Pós-unlock: traz o cofre do servidor (ou semeia + sobe um cofre novo). */
  async function syncAfterUnlock(keys: VaultKeys, meta: VaultMeta, version: number): Promise<void> {
    if (version > 0) {
      const data = await pullVault(keys, meta.userId, version);
      if (data) await loadVault(db, data);
      set({ version });
    } else {
      await seedIfEmpty();
      const data = await dumpVault(db);
      const newVersion = await pushVault(keys, meta.userId, 0, data);
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
      set({
        status: "locked",
        userId: user.id,
        email: user.email ?? null,
        meta: server.meta,
        version: server.version,
      });
    },

    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
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

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
      await supabase.auth.signOut();
      set({ status: "signedOut", userId: null, email: null, keys: null, meta: null, version: 0 });
    },

    async unlock(password) {
      const { meta } = get();
      if (!meta) throw new Error("cofre não carregado");
      const keys = await cryptoUnlockPw(meta, password);
      set({ status: "unlocked", keys });
      await syncAfterUnlock(keys, meta, get().version);
    },

    async unlockWithRecovery(code) {
      const { meta } = get();
      if (!meta) throw new Error("cofre não carregado");
      const keys = await cryptoUnlockCode(meta, code);
      set({ status: "unlocked", keys });
      await syncAfterUnlock(keys, meta, get().version);
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
      await db.transaction("rw", db.tables, async () => {
        for (const t of db.tables) await t.clear();
      });
      set({ status: "signedOut", userId: null, email: null, keys: null, meta: null, version: 0 });
    },

    async push() {
      const { keys, userId, version } = get();
      if (!keys || !userId) return; // cofre trancado → nunca escreve
      set({ syncing: true });
      try {
        const data = await dumpVault(db);
        try {
          const v = await pushVault(keys, userId, version, data);
          set({ version: v });
        } catch (e) {
          // conflito de versão (outro dispositivo) → puxa, reaplica, re-sobe
          if (e instanceof Error && /version_conflict/.test(e.message)) {
            const server = await fetchVaultMeta(userId);
            if (server) {
              const remote = await pullVault(keys, userId, server.version);
              if (remote) await loadVault(db, remote);
              const merged = await dumpVault(db);
              const v = await pushVault(keys, userId, server.version, merged);
              set({ version: v });
            }
          } else {
            throw e;
          }
        }
      } finally {
        set({ syncing: false });
      }
    },

    dismissRecoveryCode() {
      set({ recoveryCodeOnce: null });
    },

    lock() {
      set({ status: "locked", keys: null });
    },
  };
});
