import "server-only";
import { env, features } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Verificação de captcha (Cloudflare Turnstile). ENGATILHADO: sem
 * TURNSTILE_SECRET_KEY, `verifyCaptcha` retorna true (no-op) — o app funciona
 * sem captcha. Ligar = preencher TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 */

export function isCaptchaEnabled(): boolean {
  return features.captcha;
}

/**
 * Valida um token Turnstile no servidor. Retorna true se válido (ou se captcha
 * está desligado). Fail-open controlado: se o serviço do Cloudflare cair,
 * loga e DEIXA passar (não derruba o signup legítimo) — decisão da AUTH.
 */
export async function verifyCaptcha(token: string | null, ip?: string | null): Promise<boolean> {
  if (!features.captcha) return true; // desligado → no-op
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set("secret", env.TURNSTILE_SECRET_KEY!);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success: boolean };
    return Boolean(data.success);
  } catch (e) {
    logger.warn("Turnstile indisponível — liberando (fail-open)", { msg: String(e) });
    return true;
  }
}
