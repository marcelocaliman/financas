import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  wrapEmail,
  heading,
  lead,
  paragraph,
  button,
  infoList,
  kpiBox,
  notice,
  divider,
  urlBox,
  escapeHtml,
} from "@/lib/email/layout";
import { htmlToText } from "@/lib/email/plain-text";
import { formatDateNumeric } from "@/lib/utils/format";
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
        body: JSON.stringify(buildResendPayload(fromEmail, p.to, p.subject, p.body)),
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
 * Constrói payload Resend com html + text + headers profissionais.
 * Centralizado pra ambos sendEmail e drainEmailQueue usarem o mesmo formato.
 */
function buildResendPayload(
  from: string,
  to: string,
  subject: string,
  html: string,
): Record<string, unknown> {
  return {
    from,
    to,
    subject,
    html,
    text: htmlToText(html),
    headers: {
      // Sinaliza pra Gmail/Apple Mail que é email transacional
      // (melhor deliverability vs marketing classification)
      "X-Entity-Ref-ID": crypto.randomUUID(),
      // Resposta vai pro domínio mas com instrução clara que é unattended
      "Reply-To": from,
    },
  };
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
        body: JSON.stringify(
          buildResendPayload(
            fromEmail,
            e.recipient_email,
            e.subject ?? "(sem assunto)",
            body,
          ),
        ),
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

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function tmplAccountantInvite(args: {
  inviterName: string;
  householdName: string;
  inviteUrl: string;
  years: number[];
  expiresAt: string;
}): { subject: string; body: string } {
  const expires = new Date(args.expiresAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const yearsLabel = args.years.join(", ");
  return {
    subject: `${args.inviterName} liberou acesso aos dados de IRPF`,
    body: wrapEmail({
      preheader: `Acesso temporário, somente leitura, válido até ${expires}.`,
      eyebrow: "Convite · acesso ao IRPF",
      content:
        heading(`Você foi convidado para revisar uma declaração de IRPF`) +
        lead(
          `${args.inviterName} (${args.householdName}) liberou acesso aos dados de imposto de renda dos anos-base ${yearsLabel}.`,
        ) +
        button("Ativar acesso", args.inviteUrl) +
        paragraph(
          `Se o botão não funcionar, copie o endereço abaixo:`,
        ) +
        urlBox(args.inviteUrl) +
        divider() +
        paragraph(
          `<strong style="color:#1a1a1a;">O que você vai acessar:</strong> Bens e Direitos, Rendimentos (tributáveis, isentos e exclusivos), Renda Variável, DARFs e Imposto devido. Tudo organizado exatamente nas seções do programa IRPF.`,
        ) +
        notice(
          `<strong>Acesso somente-leitura.</strong> Toda visualização e download ficam registrados em audit log compartilhado com o cliente.`,
          "info",
        ) +
        paragraph(
          `<span style="color:#6a6a6a;font-size:13px;">Validade: até ${escapeHtml(expires)}. Após esse prazo o acesso expira automaticamente.</span>`,
        ),
      footerNote: `Acesso concedido conforme termo de tratamento de dados (LGPD).`,
    }),
  };
}

export function tmplAccountantAccessNotification(args: {
  accountantName: string;
  householdName: string;
  action: string;
  year?: number;
  ip?: string;
}): { subject: string; body: string } {
  const actionLabels: Record<string, string> = {
    view_year: "Abriu o ano",
    view_section: "Visualizou seção",
    export_dec: "Baixou arquivo .DEC",
    export_txt: "Baixou relatório TXT",
    login: "Acessou o painel",
  };
  const actionLabel = actionLabels[args.action] ?? args.action;
  const items: Array<{ label: string; value: string }> = [
    { label: "Contador", value: args.accountantName },
    { label: "Ação", value: actionLabel },
  ];
  if (args.year) items.push({ label: "Ano-base", value: String(args.year) });
  if (args.ip) items.push({ label: "IP", value: args.ip });
  items.push({
    label: "Quando",
    value: new Date().toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }),
  });

  return {
    subject: `Acesso do contador registrado · ${args.householdName}`,
    body: wrapEmail({
      preheader: `${args.accountantName} acabou de acessar seus dados de IRPF.`,
      eyebrow: "Notificação · LGPD",
      content:
        heading(`Seu contador acessou os dados de IRPF`) +
        lead(
          `Esta é uma notificação automática de acesso aos dados sensíveis do seu lar.`,
        ) +
        infoList(items) +
        button("Ver audit log completo", "https://nossasfinancas.com.br/ir") +
        notice(
          `Se você <strong>não autorizou</strong> este acesso ou suspeita de uso indevido, revogue imediatamente em <a href="https://nossasfinancas.com.br/ir" style="color:#ad2d10;text-decoration:underline;">Configurações de IRPF → Compartilhar com contador</a>.`,
          "danger",
        ),
      footerNote: `Você recebe esta notificação porque um terceiro acessou dados do seu lar.`,
    }),
  };
}

export function tmplDarfDue(args: {
  amount: number;
  dueDate: string;
  kind: string;
}): { subject: string; body: string } {
  const due = formatDateNumeric(args.dueDate);
  return {
    subject: `DARF de R$ ${fmtBRL(args.amount)} vence em ${due}`,
    body: wrapEmail({
      preheader: `${args.kind} — não pagar gera multa de 0,33%/dia + juros Selic.`,
      eyebrow: "Lembrete · DARF",
      content:
        heading(`Vencimento de DARF se aproxima`) +
        lead(
          `Você tem um DARF de ${args.kind} em aberto. Pague em dia para evitar multa e juros.`,
        ) +
        kpiBox({
          label: "Valor",
          value: `R$ ${fmtBRL(args.amount)}`,
          hint: args.kind,
          tone: "negative",
        }) +
        infoList([
          { label: "Tipo", value: args.kind },
          { label: "Vencimento", value: due },
        ]) +
        button("Ver detalhes no app", "https://nossasfinancas.com.br/ir") +
        notice(
          `<strong>Atraso custa caro:</strong> multa de 0,33%/dia (cap em 20%) mais juros pela taxa Selic. Pague no app do banco ou em Receita.gov.br.`,
          "warning",
        ),
      footerNote: `Lembrete enviado 3 dias antes do vencimento.`,
    }),
  };
}

// ============================================================================
// BILLING templates — dunning (pagamento pendente) e suspensão
// ============================================================================

export function tmplBillingPastDue(args: {
  daysOverdue: number;
  graceDays: number;
}): { subject: string; body: string } {
  const left = Math.max(0, args.graceDays - args.daysOverdue);
  return {
    subject: "Pagamento pendente — regularize pra manter o acesso",
    body: wrapEmail({
      preheader: `Seu pagamento falhou. Você tem ${left} dia(s) pra regularizar.`,
      eyebrow: "Assinatura · pagamento",
      content:
        heading("Não conseguimos processar seu pagamento") +
        lead(
          `Tentamos cobrar sua assinatura e o pagamento não passou. Atualize a forma de pagamento pra não perder o acesso de edição. Seus dados continuam a salvo e exportáveis.`,
        ) +
        infoList([
          { label: "Dias em atraso", value: String(args.daysOverdue) },
          { label: "Prazo pra regularizar", value: `${left} dia(s)` },
        ]) +
        button("Atualizar pagamento", "https://nossasfinancas.com.br/configuracoes/billing") +
        notice(
          `Após ${args.graceDays} dias sem pagamento, a conta entra em modo somente-leitura até a regularização.`,
          "warning",
        ),
      footerNote: "Você recebe este aviso enquanto o pagamento estiver pendente.",
    }),
  };
}

export function tmplBillingSuspended(): { subject: string; body: string } {
  return {
    subject: "Assinatura suspensa — modo somente-leitura",
    body: wrapEmail({
      preheader: "Sua conta está em somente-leitura até regularizar o pagamento.",
      eyebrow: "Assinatura · suspensa",
      content:
        heading("Sua assinatura foi suspensa") +
        lead(
          `Como o pagamento ficou pendente além do prazo, sua conta entrou em modo somente-leitura. Você ainda acessa e exporta tudo — só não dá pra editar até regularizar.`,
        ) +
        button("Regularizar agora", "https://nossasfinancas.com.br/configuracoes/billing") +
        notice(
          `Nada foi apagado. Assim que o pagamento for confirmado, a edição volta na hora.`,
          "info",
        ),
      footerNote: "Precisa de ajuda? Responda este e-mail.",
    }),
  };
}

// ============================================================================
// AUTH templates — usados pelo Send Email Hook do Supabase
// (POST /api/auth/email-hook intercepta os emails de auth e envia via Resend
// com estes templates, no mesmo padrão visual dos outros emails do app)
// ============================================================================

export function tmplAuthRecovery(args: { url: string }): { subject: string; body: string } {
  return {
    subject: "Recuperar acesso · Finanças",
    body: wrapEmail({
      preheader: "Crie uma nova senha pra sua conta. Link válido por 1h.",
      eyebrow: "Recuperar acesso",
      content:
        heading("Esqueceu a senha?") +
        lead(
          "Você pediu pra recuperar o acesso da sua conta. Clique abaixo pra criar uma nova senha.",
        ) +
        button("Criar nova senha", args.url) +
        notice(
          "O link expira em <b>1 hora</b>. Se você não pediu este email, pode ignorar — sua senha continua a mesma.",
          "info",
        ) +
        paragraph(`Não consegue clicar? Cole no navegador:`) +
        urlBox(args.url),
      footerNote: "Se não foi você que pediu, ignore este email com segurança.",
    }),
  };
}

export function tmplAuthMagicLink(args: { url: string }): { subject: string; body: string } {
  return {
    subject: "Seu link de acesso · Finanças",
    body: wrapEmail({
      preheader: "Clique pra entrar no Finanças sem digitar senha.",
      eyebrow: "Link de acesso",
      content:
        heading("Entre na sua conta") +
        lead("Você pediu um link de acesso. Clique abaixo pra entrar — sem digitar senha.") +
        button("Entrar no Finanças", args.url) +
        notice(
          "O link expira em <b>1 hora</b> e só funciona uma vez. Se não foi você, ignore este email.",
          "info",
        ) +
        paragraph(`Não consegue clicar? Cole no navegador:`) +
        urlBox(args.url),
    }),
  };
}

export function tmplAuthConfirmSignup(args: { url: string }): { subject: string; body: string } {
  return {
    subject: "Confirme seu email · Finanças",
    body: wrapEmail({
      preheader: "Quase lá! Confirme seu email pra ativar sua conta.",
      eyebrow: "Bem-vindo",
      content:
        heading("Confirme seu email") +
        lead("Quase lá! Clique abaixo pra ativar sua conta e começar a usar.") +
        button("Ativar minha conta", args.url) +
        paragraph(`Não consegue clicar? Cole no navegador:`) +
        urlBox(args.url),
    }),
  };
}

export function tmplAuthEmailChange(args: { url: string; newEmail?: string }): {
  subject: string;
  body: string;
} {
  return {
    subject: "Confirme seu novo email · Finanças",
    body: wrapEmail({
      preheader: "Confirme a mudança de email da sua conta.",
      eyebrow: "Mudança de email",
      content:
        heading("Confirme seu novo email") +
        lead(
          args.newEmail
            ? `Você pediu pra trocar o email da sua conta para ${args.newEmail}. Clique abaixo pra confirmar.`
            : "Você pediu pra trocar o email da sua conta. Clique abaixo pra confirmar.",
        ) +
        button("Confirmar novo email", args.url) +
        notice(
          "Se você não fez essa solicitação, ignore — seu email atual continua ativo.",
          "warning",
        ) +
        paragraph(`Não consegue clicar? Cole no navegador:`) +
        urlBox(args.url),
    }),
  };
}

export function tmplAuthReauthentication(args: { token: string }): {
  subject: string;
  body: string;
} {
  return {
    subject: "Código de verificação · Finanças",
    body: wrapEmail({
      preheader: `Seu código: ${args.token}`,
      eyebrow: "Verificação",
      content:
        heading("Código de verificação") +
        lead(
          "Use o código abaixo pra confirmar uma ação sensível na sua conta (mudança de email/senha).",
        ) +
        kpiBox({
          label: "Código",
          value: args.token,
          hint: "Expira em 5 minutos",
        }) +
        notice("Se não foi você, ignore este email e troque sua senha por garantia.", "warning"),
    }),
  };
}

export function tmplMonthlyNarrative(args: {
  recipientName: string | null;
  monthLabel: string;
  title: string;
  lead: string;
  paragraphs: string[];
  closing: string;
  highlights: Array<{ label: string; value: string; tone: "positive" | "negative" | "neutral" }>;
}): { subject: string; body: string } {
  const greeting = args.recipientName
    ? `Olá, ${escapeHtml(args.recipientName)}.`
    : "Olá.";

  const highlightsHtml = args.highlights
    .map((h) =>
      kpiBox({
        label: h.label,
        value: h.value,
        tone: h.tone === "positive" ? "positive" : h.tone === "negative" ? "negative" : "neutral",
      }),
    )
    .join("");

  const paragraphsHtml = args.paragraphs.map((p) => paragraph(escapeHtml(p))).join("");

  return {
    subject: `Resumo de ${args.monthLabel} — ${args.title}`,
    body: wrapEmail({
      preheader: args.lead,
      eyebrow: `Resumo mensal · ${args.monthLabel}`,
      content:
        heading(args.title) +
        lead(`${greeting} ${args.lead}`) +
        highlightsHtml +
        divider() +
        paragraphsHtml +
        paragraph(`<em style="color:#6a6a6a;">${escapeHtml(args.closing)}</em>`) +
        button("Abrir o app", "https://nossasfinancas.com.br/dashboard"),
      footerNote: `Os números são calculados direto dos seus dados; o texto é gerado por IA. Você pode desativar em Configurações → Notificações.`,
    }),
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
  const items = args.staleChecks.map((c) => {
    const ageDisplay =
      c.ageHours < 0
        ? "idade desconhecida"
        : c.ageHours < 24
          ? `${Math.round(c.ageHours)} horas`
          : `${Math.round(c.ageHours / 24)} dias`;
    const limit = Math.round(c.staleAfterHours / 24) || 1;
    return {
      label: c.name,
      value: `${ageDisplay} (limite ${limit}d)`,
    };
  });
  return {
    subject: `Alerta: ${args.staleChecks.length} cron${args.staleChecks.length === 1 ? "" : "s"} desatualizado${args.staleChecks.length === 1 ? "" : "s"}`,
    body: wrapEmail({
      preheader: `Verifique os logs no dashboard Vercel.`,
      eyebrow: "Health check · sistema",
      content:
        heading(`Alguns jobs não rodaram como esperado`) +
        lead(
          `Os crons abaixo estão sem atualização há mais tempo que o tolerado. Pode ser falha de execução, problema de schedule ou limites do plano Vercel.`,
        ) +
        infoList(items) +
        button("Abrir Vercel Logs", "https://vercel.com/dashboard", "secondary") +
        notice(
          `Vercel Hobby permite só 2 cron schedules. Se subiu acima disso, alguns não rodam silenciosamente.`,
          "info",
        ),
      footerNote: `Health check diário · dedup de 20h pra não te spammar.`,
    }),
  };
}
