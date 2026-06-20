import { useSyncExternalStore } from "react";
import {
  getDeferredPrompt,
  subscribeInstall,
  triggerInstall,
  isStandalone,
  isIOS,
} from "@/lib/pwa-install";

/**
 * Estado de "dá pra instalar?" reativo. `canInstall` = evento nativo disponível (Android/
 * desktop Chrome). `iosHint` = iOS fora do standalone (mostrar instruções). `standalone` =
 * já instalado (esconder tudo). `install()` dispara o prompt nativo.
 */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    subscribeInstall,
    () => getDeferredPrompt() != null,
    () => false,
  );
  const standalone = isStandalone();
  const ios = isIOS();
  return {
    canInstall,
    standalone,
    iosHint: ios && !standalone,
    install: triggerInstall,
  };
}
