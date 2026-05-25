import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  sendEmail,
  tmplAuthRecovery,
  tmplAuthMagicLink,
  tmplAuthConfirmSignup,
  tmplAuthEmailChange,
  tmplAuthReauthentication,
} from "@/services/email";

/**
 * Send Email Hook do Supabase — intercepta TODOS os emails de auth
 * (reset password, magic link, signup, email change, reauthentication) e
 * envia via Resend com nossos templates próprios. Isso unifica:
 *   - Sender: Finanças <no-reply@nossasfinancas.com.br> (mesmo dos outros)
 *   - Templates: mesmo layout master que o resto
 *   - Logs: tudo em email_notifications_log
 *
 * Setup:
 *   1. Dashboard Supabase → Auth → Hooks → Send Email Hook
 *   2. URL: https://nossasfinancas.com.br/api/auth/email-hook
 *   3. Secret: gerar com `openssl rand -base64 32` (formato v1,whsec_...)
 *   4. Adicionar no env: SUPABASE_AUTH_HOOK_SECRET=v1,whsec_...
 *
 * Segurança: valida assinatura HMAC-SHA256 do header `webhook-signature`
 * (padrão Standard Webhooks adotado pelo Supabase).
 */

export const dynamic = "force-dynamic";

type EmailActionType =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

type HookPayload = {
  user: {
    id: string;
    email: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

/**
 * Valida assinatura webhook conforme Standard Webhooks
 * (https://github.com/standard-webhooks/standard-webhooks).
 * Formato do header: "v1,<base64-hmac>" (pode ter múltiplas assinaturas separadas por espaço).
 */
function verifySignature(
  rawBody: string,
  msgId: string,
  msgTimestamp: string,
  signatureHeader: string,
  secret: string,
): boolean {
  // Secret vem como "v1,whsec_..." → extrai a parte base64
  const secretClean = secret.startsWith("v1,whsec_") ? secret.slice(9) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretClean, "base64");
  } catch {
    return false;
  }

  const signedPayload = `${msgId}.${msgTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

  // signatureHeader pode conter múltiplas: "v1,abc v1,xyz"
  const signatures = signatureHeader.split(" ").map((s) => s.trim().replace(/^v1,/, ""));
  for (const sig of signatures) {
    try {
      if (
        sig.length === expected.length &&
        timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    console.error("[email-hook] SUPABASE_AUTH_HOOK_SECRET not configured");
    return NextResponse.json({ error: "hook_not_configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const msgId = req.headers.get("webhook-id") ?? "";
  const msgTimestamp = req.headers.get("webhook-timestamp") ?? "";
  const signature = req.headers.get("webhook-signature") ?? "";

  if (!msgId || !msgTimestamp || !signature) {
    return NextResponse.json({ error: "missing_webhook_headers" }, { status: 400 });
  }

  // Reject mensagens > 5 min de idade (replay attack)
  const ts = parseInt(msgTimestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return NextResponse.json({ error: "stale_timestamp" }, { status: 400 });
  }

  if (!verifySignature(rawBody, msgId, msgTimestamp, signature, secret)) {
    console.error("[email-hook] invalid signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { user, email_data } = payload;
  if (!user?.email || !email_data?.email_action_type) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // Constrói a URL de confirmação no padrão que o Supabase usaria.
  // Formato: {site_url}/auth/v1/verify?token={token_hash}&type={type}&redirect_to={redirect_to}
  const confirmUrl = `${email_data.site_url}/auth/v1/verify?token=${encodeURIComponent(
    email_data.token_hash,
  )}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

  // Mapeia tipo → template do app
  let template: { subject: string; body: string };
  switch (email_data.email_action_type) {
    case "recovery":
      template = tmplAuthRecovery({ url: confirmUrl });
      break;
    case "magiclink":
      template = tmplAuthMagicLink({ url: confirmUrl });
      break;
    case "signup":
    case "invite":
      template = tmplAuthConfirmSignup({ url: confirmUrl });
      break;
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      template = tmplAuthEmailChange({
        url: confirmUrl,
        newEmail: user.new_email,
      });
      break;
    case "reauthentication":
      template = tmplAuthReauthentication({ token: email_data.token });
      break;
    default:
      console.warn("[email-hook] unknown action type:", email_data.email_action_type);
      return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  }

  // Envia via Resend (sender + logs unificados com o resto do app)
  const result = await sendEmail({
    to: user.email,
    subject: template.subject,
    body: template.body,
    notificationType: `auth_${email_data.email_action_type}`,
  });

  if (!result.ok) {
    console.error("[email-hook] resend failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
