/**
 * Detecção de "app nativo" (Capacitor) — PREP pro empacotamento Play/App Store.
 *
 * Hoje (web pura) `isNativeApp()` é sempre false, então nada muda. Quando o Capacitor for
 * adicionado, o runtime injeta `window.Capacitor` e as respostas passam a valer no app nativo,
 * SEM precisar mexer nos componentes que já consultam estes helpers.
 *
 * Para TESTAR o comportamento "modo app" na web (ex.: a tela de assinatura só-web), use
 * `?native=1` na URL ou `localStorage.setItem("nf-native","1")`.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True quando rodando dentro do app nativo (Capacitor) — ou forçado p/ teste (?native=1). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("native") === "1") return true;
    if (window.localStorage.getItem("nf-native") === "1") return true;
  } catch {
    /* ignora acesso bloqueado */
  }
  return !!cap()?.isNativePlatform?.();
}

/** Plataforma corrente: "ios" | "android" | "web". */
export function nativePlatform(): "ios" | "android" | "web" {
  const p = cap()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

/** Abre uma URL externa. Web: nova aba. No app nativo (futuro) trocar por `Browser.open` do Capacitor. */
export function openExternal(url: string): void {
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}
