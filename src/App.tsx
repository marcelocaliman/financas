import { useEffect } from "react";
import { useVault } from "@/vault/vault-store";
import { useUI } from "@/store/ui";
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

  useEffect(() => {
    void init();
  }, [init]);

  // Tema aplicado em todo o app, inclusive nas telas de auth.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  if (status === "loading") return <Splash />;
  if (status !== "unlocked") return <AuthGate />;

  return (
    <>
      <AppShell />
      <RecoveryCodeDialog />
    </>
  );
}
