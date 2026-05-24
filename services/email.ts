import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Wrapper de envio de emails. Loga em email_notifications_log
 * independente de se o envio real foi feito ou não.
 *
 * No MVP atual: NÃO envia email de verdade (sem SMTP/Resend configurado).
 * Apenas grava em log com status="queued" → outro processo (cron ou hook)
 * pode pegar e mandar via Resend depois. Plug-and-play.
 *
 * Quando configurar RESEND_API_KEY no env, ativar enviar de verdade aqui.
 */

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
  notificationType: string;
  recipientUserId?: string | null;
  relatedHouseholdId?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function sendEmail(p: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.EMAIL_FROM ?? "Finanças <no-reply@financas.example.com>";

  let status: "queued" | "sent" | "failed" = "queued";
  let errorMessage: string | null = null;
  let sentAt: string | null = null;

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: p.to,
          subject: p.subject,
          html: p.body,
        }),
      });
      if (res.ok) {
        status = "sent";
        sentAt = new Date().toISOString();
      } else {
        status = "failed";
        errorMessage = await res.text();
      }
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : String(e);
    }
  }

  await admin.from("email_notifications_log").insert({
    recipient_email: p.to,
    recipient_user_id: p.recipientUserId ?? null,
    notification_type: p.notificationType,
    subject: p.subject,
    status,
    related_household_id: p.relatedHouseholdId ?? null,
    related_entity_id: p.relatedEntityId ?? null,
    metadata: (p.metadata ?? {}) as Json,
    error_message: errorMessage,
    sent_at: sentAt,
  });

  return { ok: status !== "failed", error: errorMessage ?? undefined };
}

// ============================================================================
// Templates
// ============================================================================

export function tmplAccountantInvite(args: {
  inviterName: string;
  householdName: string;
  inviteUrl: string;
  years: number[];
  expiresAt: string;
}): { subject: string; body: string } {
  return {
    subject: `${args.inviterName} liberou acesso aos dados de IRPF`,
    body: `
      <p>Olá,</p>
      <p>${args.inviterName} (${args.householdName}) acabou de liberar acesso aos
      dados de IRPF dos anos-base ${args.years.join(", ")} pelo aplicativo Finanças.</p>
      <p>Acesse o link abaixo pra ativar (válido até ${new Date(args.expiresAt).toLocaleDateString("pt-BR")}):</p>
      <p><a href="${args.inviteUrl}">${args.inviteUrl}</a></p>
      <p><b>O que você vai acessar:</b> Bens e Direitos, Rendimentos, Renda
      Variável, DARFs, Imposto a pagar/restituição — tudo organizado
      automaticamente nas seções do programa IRPF.</p>
      <p><b>Importante:</b> acesso somente-leitura. Todas as suas ações ficam
      registradas em audit log compartilhado com o cliente.</p>
      <hr>
      <p style="color:#888;font-size:11px">Email automático do Finanças. Conforme LGPD.</p>
    `,
  };
}

export function tmplAccountantAccessNotification(args: {
  accountantName: string;
  householdName: string;
  action: string;
  year?: number;
  ip?: string;
}): { subject: string; body: string } {
  return {
    subject: `Seu contador acessou os dados de IRPF`,
    body: `
      <p>Olá,</p>
      <p>${args.accountantName} acabou de acessar os dados de IRPF do ${args.householdName}.</p>
      <ul>
        <li>Ação: ${args.action}</li>
        ${args.year ? `<li>Ano-base: ${args.year}</li>` : ""}
        ${args.ip ? `<li>IP: ${args.ip}</li>` : ""}
        <li>Horário: ${new Date().toLocaleString("pt-BR")}</li>
      </ul>
      <p>Veja o audit log completo na seção "Compartilhar com contador" das
      configurações de IRPF.</p>
      <p>Se você não autorizou esse acesso, <b>revogue imediatamente</b>.</p>
    `,
  };
}

export function tmplDarfDue(args: {
  amount: number;
  dueDate: string;
  kind: string;
}): { subject: string; body: string } {
  return {
    subject: `DARF de R$ ${args.amount.toFixed(2)} vence em breve`,
    body: `
      <p>Olá,</p>
      <p>Você tem um DARF de <b>${args.kind}</b> no valor de
      <b>R$ ${args.amount.toFixed(2)}</b> com vencimento em
      <b>${new Date(args.dueDate).toLocaleDateString("pt-BR")}</b>.</p>
      <p>Pague no app do seu banco, ou no Receita.gov pra evitar multa (0,33%/dia
      atrasado + juros Selic).</p>
    `,
  };
}
