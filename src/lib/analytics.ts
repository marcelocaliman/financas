/**
 * Tracker de analytics PRÓPRIO (privacy-first). Manda eventos NÃO-sensíveis pro
 * coletor de 1ª-parte (/api/track) — sem cookie, sem PII, sem dado financeiro.
 *
 * O id de visitante (anon_id) é um valor aleatório de 1ª-parte em localStorage:
 * pseudônimo, sem cookie, sem rastreio entre sites. Como a landing (raiz) e o app
 * (/app) compartilham origem, o mesmo anon_id costura o funil (visita → cadastro).
 */
const ANON_KEY = "nf-anon";

function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2)).replace(/-/g, "").slice(0, 24);
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export type EventName = "signup" | "login" | "app_open" | "section_view" | "app_error";

/** Registra um evento do APP (best-effort; nunca lança nem bloqueia a UI). */
export function track(name: EventName, props?: Record<string, string | number | boolean>): void {
  try {
    const payload = {
      n: name,
      s: "app",
      a: anonId(),
      l: (typeof navigator !== "undefined" && navigator.language) || null,
      path: typeof location !== "undefined" ? location.pathname : null,
      p: props ?? {},
    };
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // best-effort
  }
}
