import { useEffect } from "react";
import { useVault } from "@/vault/vault-store";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useAdminUI } from "@/store/admin-ui";
import { useIsAdmin } from "@/admin/use-admin";
import { usePresenceTracker } from "@/lib/presence";
import { AdminApp } from "@/admin/admin-app";
import { AdminTicketsApp } from "@/admin/admin-tickets-app";
import { AuthGate } from "@/components/auth/auth-gate";
import { RecoveryCodeDialog } from "@/components/auth/recovery-code-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { SupportApp } from "@/app/support-app";

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
  const ticketsView = useAdminUI((s) => s.ticketsView);
  const supportOpen = useUI((s) => s.supportOpen);
  const syncFromPath = useAdminUI((s) => s.syncFromPath);
  const { isAdmin, resolving: adminResolving } = useIsAdmin();

  // URL própria do painel (/app/admin): mantém o estado em sincronia com voltar/avançar.
  useEffect(() => {
    const sync = () => syncFromPath();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [syncFromPath]);

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

  // Painel super-admin (só pro dono): substitui o app enquanto aberto. Tickets = view própria.
  if (adminOpen && isAdmin) return ticketsView ? <AdminTicketsApp /> : <AdminApp />;
  // Em /app/admin, enquanto confirma se é admin, mostra splash — NÃO pisca o app do usuário.
  if (adminOpen && adminResolving) return <Splash />;

  // Ajuda & Suporte: tela cheia própria (igual ao painel), fora da rolagem do dashboard.
  if (supportOpen) return <SupportApp />;

  return (
    <>
      <AppShell />
      <RecoveryCodeDialog />
    </>
  );
}
