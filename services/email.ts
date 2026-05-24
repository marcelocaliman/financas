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

/**
 * Enfileira email no log com status='queued'. Não envia agora.
 * O cron job `/api/cron/send-pending-emails` processa em background.
 *
 * Caller deve usar SEMPRE este por padrão — UX rápida, sem await blocking
 * de 200-500ms do Resend.
 */
export async function queueEmail(p: EmailPayload): Promise<void> {
  const admin = createAdminClient();
  // Conserva também body+html via metadata pra o cron poder enviar depois
  // sem precisar recomputar template.
  const metadata = {
    ...(p.metadata ?? {}),
    body: p.body, // o cron usa este campo pra render HTML
  } as Json;

  await admin.from("email_notifications_log").insert({
    recipient_email: p.to,
    recipient_user_id: p.recipientUserId ?? null,
    notification_type: p.notificationType,
    subject: p.subject,
    status: "queued",
    related_household_id: p.relatedHouseholdId ?? null,
    related_entity_id: p.relatedEntityId ?? null,
    metadata,
    error_message: null,
    sent_at: null,
  });
}

/**
 * Envia imediato (síncrono) — usar APENAS quando o caller quer confirmar
 * entrega antes de retornar (ex.: confirmação de senha via email).
 * Pra outros casos use queueEmail.
 */
export async function sendEmail(p: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const apiKey = process.env.RESEND_API_KEY;
  // onboarding@resend.dev é o sender default do Resend free tier — funciona
  // sem domínio verificado. Trocar pra "Finanças <no-reply@seudominio.com>"
  // quando tiver domínio próprio configurado.
  const fromEmail =
    process.env.EMAIL_FROM ?? "Finanças <onboarding@resend.dev>";

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

/**
 * Drena a fila — processa até `limit` emails com status='queued' e envia
 * via Resend. Chamado pelo cron `/api/cron/send-pending-emails`.
 *
 * Idempotente: marca cada email pra "sent" ou "failed" individualmente.
 * Faiilhas viram retry no próximo ciclo (status volta pra queued se < 5
 * tentativas via metadata.attempts).
 */
export async function drainEmailQueue(limit = 50): Promise<{
  attempted: number;
  sent: number;
  failed: number;
  skippedNoApiKey: boolean;
}> {
  const admin = createAdminClient();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { attempted: 0, sent: 0, failed: 0, skippedNoApiKey: true };
  }

  // Mesma lógica do sender — usa onboarding@resend.dev quando sem domínio
  const fromEmail =
    process.env.EMAIL_FROM ?? "Finanças <onboarding@resend.dev>";

  const { data: pending } = await admin
    .from("email_notifications_log")
    .select("id, recipient_email, subject, metadata")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let failed = 0;
  for (const e of pending ?? []) {
    const meta = (e.metadata ?? {}) as { body?: string; attempts?: number };
    const body = meta.body ?? "(corpo do email vazio — verificar template)";
    const attempts = (meta.attempts ?? 0) + 1;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: e.recipient_email,
          subject: e.subject ?? "(sem assunto)",
          html: body,
        }),
      });
      if (res.ok) {
        await admin
          .from("email_notifications_log")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            metadata: { ...meta, attempts },
          })
          .eq("id", e.id);
        sent++;
      } else {
        const errText = await res.text();
        // Se < 5 tentativas, deixa em queued pra retry. Senão marca failed.
        await admin
          .from("email_notifications_log")
          .update({
            status: attempts >= 5 ? "failed" : "queued",
            error_message: errText,
            metadata: { ...meta, attempts },
          })
          .eq("id", e.id);
        failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from("email_notifications_log")
        .update({
          status: attempts >= 5 ? "failed" : "queued",
          error_message: msg,
          metadata: { ...meta, attempts },
        })
        .eq("id", e.id);
      failed++;
    }
  }

  return {
    attempted: (pending ?? []).length,
    sent,
    failed,
    skippedNoApiKey: false,
  };
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

export function tmplCronStale(args: {
  staleChecks: Array<{
    name: string;
    description: string;
    ageHours: number;
    staleAfterHours: number;
  }>;
}): { subject: string; body: string } {
  const rows = args.staleChecks
    .map((c) => {
      const ageDisplay =
        c.ageHours < 24
          ? `${Math.round(c.ageHours)}h`
          : `${Math.round(c.ageHours / 24)}d`;
      const limitDisplay = Math.round(c.staleAfterHours / 24) || 1;
      return `<li><b>${c.name}</b> — ${ageDisplay} (limite ${limitDisplay}d)<br><span style="color:#888;font-size:11px">${c.description}</span></li>`;
    })
    .join("");
  return {
    subject: `⚠ ${args.staleChecks.length} cron${args.staleChecks.length === 1 ? "" : "s"} desatualizado${args.staleChecks.length === 1 ? "" : "s"}`,
    body: `
      <p>Olá,</p>
      <p>Os seguintes crons do Finanças estão desatualizados além do limite tolerado:</p>
      <ul>${rows}</ul>
      <p>Verifique o dashboard Vercel pra ver erros de execução. Se o cron rodou
      e falhou, vai aparecer nos logs. Se nem rodou, pode ser problema de schedule
      ou plano (Hobby permite só 2 crons/dia).</p>
      <hr>
      <p style="color:#888;font-size:11px">Email automático do Finanças · health check</p>
    `,
  };
}
