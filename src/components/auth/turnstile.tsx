import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare Turnstile (privacy-friendly, sem rastreamento da Google — coerente com o E2EE).
// Site key vem da env; SEM ela tudo vira no-op (CAPTCHA desligado, nada muda no fluxo).
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** True quando há site key configurada (CAPTCHA ativo). */
export const captchaEnabled = Boolean(SITE_KEY);

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      execute: (id: string) => void;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("turnstile load failed"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export interface TurnstileHandle {
  /** Resolve um token NOVO (dispara o desafio invisível). null se desligado/indisponível. */
  getToken(): Promise<string | null>;
}

/**
 * Cloudflare Turnstile INVISÍVEL (oculto). Não mostra nada para o usuário legítimo; `getToken()`
 * dispara a verificação e resolve o token. No-op completo quando não há site key (dormente).
 */
export const Turnstile = forwardRef<TurnstileHandle>(function Turnstile(_props, ref) {
  const elRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const resolveRef = useRef<((t: string | null) => void) | null>(null);
  const settle = (t: string | null) => {
    resolveRef.current?.(t);
    resolveRef.current = null;
  };

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !elRef.current || !window.turnstile) return;
        idRef.current = window.turnstile.render(elRef.current, {
          sitekey: SITE_KEY,
          size: "invisible",
          callback: (t: string) => settle(t),
          "error-callback": () => settle(null),
          "timeout-callback": () => settle(null),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (idRef.current && window.turnstile) {
        try {
          window.turnstile.remove(idRef.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getToken() {
      if (!SITE_KEY) return Promise.resolve(null);
      return new Promise<string | null>((resolve) => {
        if (!window.turnstile || idRef.current == null) return resolve(null);
        resolveRef.current = resolve;
        try {
          window.turnstile.reset(idRef.current);
          window.turnstile.execute(idRef.current);
        } catch {
          resolveRef.current = null;
          return resolve(null);
        }
        // Rede de segurança: nunca trava o submit esperando o token.
        setTimeout(() => {
          if (resolveRef.current === resolve) settle(null);
        }, 9000);
      });
    },
  }));

  if (!SITE_KEY) return null;
  return <div ref={elRef} aria-hidden="true" />;
});
