"use client";

import { useEffect, useRef } from "react";

/**
 * Widget do Cloudflare Turnstile. ENGATILHADO: só renderiza se a site key
 * pública estiver setada (NEXT_PUBLIC_TURNSTILE_SITE_KEY). Injeta o token num
 * input hidden `captchaToken` que a server action valida.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    };
  }
}

export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!siteKey || rendered.current || !ref.current) return;

    function tryRender() {
      if (!ref.current || rendered.current) return;
      if (window.turnstile) {
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          // Escreve o token no input hidden do form.
          callback: (token: string) => {
            const input = ref.current?.parentElement?.querySelector<HTMLInputElement>(
              'input[name="captchaToken"]',
            );
            if (input) input.value = token;
          },
        });
        rendered.current = true;
      }
    }

    // Carrega o script do Turnstile uma vez.
    if (!document.querySelector('script[data-turnstile]')) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = "1";
      s.onload = tryRender;
      document.head.appendChild(s);
    } else {
      tryRender();
    }
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div>
      <input type="hidden" name="captchaToken" defaultValue="" />
      <div ref={ref} className="mt-1" />
    </div>
  );
}
