import { useEffect } from "react";
import { useVault } from "@/vault/vault-store";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { AuthGate } from "@/components/auth/auth-gate";
import { RecoveryCodeDialog } from "@/components/auth/recovery-code-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellV2 } from "@/v2/app-shell-v2";

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
  const uiVersion = useUI((s) => s.uiVersion);
  const setUiVersion = useUI((s) => s.setUiVersion);

  useEffect(() => {
    void init();
  }, [init]);

  // `?ui=v2` / `?ui=v1` na URL sobrepõe a preferência salva (link compartilhável p/ comparar).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("ui");
    if (p === "v2" || p === "v1") setUiVersion(p);
  }, [setUiVersion]);

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

  // Tema/UI aplicados em todo o app (inclusive auth). V2 é uma UI CLARA própria:
  // força o claro e marca data-ui="v2" (que sobrepõe os tokens de design no index.css).
  useEffect(() => {
    const root = document.documentElement;
    if (uiVersion === "v2") {
      root.setAttribute("data-ui", "v2");
      root.classList.remove("dark");
    } else {
      root.removeAttribute("data-ui");
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme, uiVersion]);

  if (status === "loading") return <Splash />;
  if (status !== "unlocked") return <AuthGate />;

  return (
    <>
      {uiVersion === "v2" ? <AppShellV2 /> : <AppShell />}
      <RecoveryCodeDialog />
    </>
  );
}
