/**
 * Captura o evento `beforeinstallprompt` (Android/desktop Chrome) o mais cedo possível —
 * por isso este módulo é importado no boot (main.tsx), antes do React montar. Guarda o
 * evento adiado pra disparar a instalação nativa quando o usuário tocar no nosso botão.
 * No iOS não existe esse evento: o app é "instalado" via Compartilhar → Adicionar à Tela
 * de Início (mostramos instruções). Nada aqui toca em dado financeiro.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // não mostra o mini-infobar do Chrome; usamos nosso botão
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function subscribeInstall(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Dispara o prompt nativo (Android/desktop). Retorna o resultado (ou "unavailable"). */
export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome;
}

/** Já está rodando instalado (standalone)? Então não oferecemos instalar. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari expõe navigator.standalone
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad (inclui iPadOS, que se passa por Mac com toque). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Celular/tablet — só oferecemos instalar aqui (no desktop o banner não aparece). */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /android|iphone|ipad|ipod|mobile|silk|kindle/i.test(ua) || isIOS();
}
