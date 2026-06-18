import { useEffect } from "react";
import { useVault } from "@/vault/vault-store";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useAdminUI } from "@/store/admin-ui";
import { useIsAdmin } from "@/admin/use-admin";
import { usePresenceTracker } from "@/lib/presence";
import { AdminApp } from "@/admin/admin-app";
import { AuthGate } from "@/components/auth/auth-gate";
import { RecoveryCodeDialog } from "@/components/auth/recovery-code-dialog";
import { AppShell } from "@/components/layout/app-shell";

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-[13px]">
      Carregando…
    </div>
  );
}

export default function App() {
  const status = useVault((s) => s.status);
  const init = useVault((s) => s.init);
  const theme = useUI((s) => s.theme);
  const adminOpen = useAdminUI((s) => s.adminOpen);
  const isAdmin = useIsAdmin();

  // "Online agora": pinga enquanto houver sessão AUTENTICADA (travada ou destravada),
  // não só no app destravado — assim o contador acusa quem está logado de verdade.
  usePresenceTracker(status === "locked" || status === "unlocked");

  useEffect(() => {
    void init();
  }, [init]);

  // Câmbio do dia: atualiza se a cotação em cache estiver velha (≥12h). Dado público,
  // seguro mesmo antes do unlock; falha silenciosa cai no cache/fallback manual.
  // Revalida ao voltar o foco da aba — cobre sessão PWA aberta por >12h sem reload.
  useEffect(() => {
    const refresh = () => void useRates.getState().refresh();
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, []);

  // Tema aplicado em todo o app, inclusive nas telas de auth.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  if (status === "loading") return <Splash />;
  if (status !== "unlocked") return <AuthGate />;

  // Painel super-admin (só pro dono): substitui o app enquanto aberto.
  if (adminOpen && isAdmin) return <AdminApp />;

  return (
    <>
      <AppShell />
      <RecoveryCodeDialog />
    </>
  );
}
