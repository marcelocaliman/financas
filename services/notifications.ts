import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail, sendEmail, tmplMonthlyNarrative } from "@/services/email";
import {
  collectMonthlyData,
  generateMonthlyNarrative,
} from "@/services/ai/monthly-narrative";
import { computeBillWindow } from "@/services/credit-card";

/**
 * Sistema de notificações por email. Roda via cron `/api/cron/notifications`
 * diariamente. Pra cada household ativo, avalia condições e dispara emails
 * (respeitando preferências + carimbo da última envio pra evitar spam).
 *
 * Casos cobertos:
 *   - darf_due_soon: DARF de renda variável vencendo em ≤3 dias e não pago
 *   - ir_retroactive_gaps: lacunas pendentes de cadastrar pra IR (1×/mês)
 *   - monthly_recap: resumo do mês fechado (dia 1 do mês seguinte)
 */

export type NotificationResult = {
  householdId: string;
  type: string;
  status: "sent" | "skipped" | "error";
  reason?: string;
};

/**
 * Roda todas as notificações pra todos os households ativos.
 * Retorna sumário dos disparos.
 */
export async function runDailyNotifications(): Promise<NotificationResult[]> {
  const admin = createAdminClient();
  const results: NotificationResult[] = [];

  const { data: households } = await admin
    .from("households")
    .select("id, name");

  if (!households) return results;

  for (const h of households) {
    // Pega preferências (cria default se não existe)
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("*")
      .eq("household_id", h.id)
      .maybeSingle();

    const effectivePrefs = prefs ?? {
      household_id: h.id,
      darf_due_soon: true,
      ir_retroactive_gaps: true,
      recurring_upcoming: false,
      monthly_recap: true,
      darf_due_soon_last_sent: null,
      ir_retroactive_gaps_last_sent: null,
      monthly_recap_last_sent: null,
    };

    // Email do owner (primeiro admin do household)
    const { data: owner } = await admin
      .from("users")
      .select("id, display_name")
      .eq("household_id", h.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!owner) continue;

    // Email vem do auth.users (Supabase)
    const { data: authData } = await admin.auth.admin.getUserById(owner.id);
    const email = authData?.user?.email;
    if (!email) continue;

    // 1. DARF vencendo em ≤3 dias
    if (effectivePrefs.darf_due_soon) {
      const result = await checkDarfDueSoon(admin, h.id, email, owner.display_name);
      if (result) results.push({ householdId: h.id, type: "darf_due_soon", ...result });
    }

    // 2. Lacunas IR retroativas (1×/mês)
    if (effectivePrefs.ir_retroactive_gaps) {
      const lastSent = effectivePrefs.ir_retroactive_gaps_last_sent;
      const daysSince = lastSent
        ? (Date.now() - new Date(lastSent).getTime()) / 86400000
        : Infinity;
      if (daysSince >= 30) {
        const result = await checkIrGaps(admin, h.id, email, owner.display_name);
        if (result) results.push({ householdId: h.id, type: "ir_retroactive_gaps", ...result });
      }
    }

    // 3. Fatura de cartão pendente/atrasada — dispara alerta no sino
    //    (user_facing=true) 3 dias antes do vencimento e diariamente após.
    const billResult = await checkCreditCardBills(admin, h.id);
    if (billResult)
      results.push({ householdId: h.id, type: "credit_card_bill", ...billResult });

    // 4. Resumo mensal narrativo (gerado por IA) — dispara no dia 2 do mês,
    //    cobre o mês anterior. Idempotente via monthly_recap_last_sent.
    if (effectivePrefs.monthly_recap) {
      const today = new Date();
      const dayOfMonth = today.getUTCDate();
      if (dayOfMonth >= 2 && dayOfMonth <= 7) {
        const lastSent = effectivePrefs.monthly_recap_last_sent;
        const daysSince = lastSent
          ? (Date.now() - new Date(lastSent).getTime()) / 86400000
          : Infinity;
        if (daysSince >= 25) {
          const result = await sendMonthlyRecap(admin, h.id, email, owner.display_name);
          if (result) results.push({ householdId: h.id, type: "monthly_recap", ...result });
        }
      }
    }
  }

  return results;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function checkDarfDueSoon(
  admin: AdminClient,
  householdId: string,
  email: string,
  name: string,
): Promise<{ status: "sent" | "skipped" | "error"; reason?: string } | null> {
  const today = new Date();
  // DARF de renda variável vence no último dia útil do MÊS SEGUINTE ao fato gerador.
  // Estratégia: pega não-pagos onde month/year é o MÊS ANTERIOR ao atual.
  const thisYear = today.getUTCFullYear();
  const thisMonth = today.getUTCMonth() + 1; // 1-12
  const prevYear = thisMonth === 1 ? thisYear - 1 : thisYear;
  const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1;
  const dayOfMonth = today.getUTCDate();
  // Só alerta nos últimos 5 dias do mês (vencimento próximo)
  if (dayOfMonth < 25) return null;

  const { data: darfs } = await admin
    .from("ir_darfs")
    .select("year, month, tax_due")
    .eq("household_id", householdId)
    .eq("year", prevYear)
    .eq("month", prevMonth)
    .is("paid_at", null)
    .gt("tax_due", 0);

  if (!darfs || darfs.length === 0) return null;

  const total = darfs.reduce((s, d) => s + Number(d.tax_due), 0);
  const subject = `DARF vencendo: R$ ${total.toFixed(2).replace(".", ",")} no fim do mês`;
  const body = `Olá, ${name}.

Você tem ${darfs.length} DARF(s) de renda variável vencendo no último dia útil de ${thisMonth}/${thisYear}:

${darfs.map((d) => `  • Fato gerador ${d.month}/${d.year}: R$ ${Number(d.tax_due).toFixed(2).replace(".", ",")}`).join("\n")}

Total: R$ ${total.toFixed(2).replace(".", ",")}

Pague via Programa IRPF / banco e marque como pago no app pra parar de receber este lembrete.

— Finanças`;

  const r = await sendEmail({
    to: email,
    subject,
    body,
    notificationType: "darf_due_soon",
    relatedHouseholdId: householdId,
  });

  if (r.ok) {
    await admin
      .from("notification_preferences")
      .update({ darf_due_soon_last_sent: new Date().toISOString() })
      .eq("household_id", householdId);
  }

  return r.ok ? { status: "sent" } : { status: "error", reason: r.error };
}

async function checkIrGaps(
  admin: AdminClient,
  householdId: string,
  email: string,
  name: string,
): Promise<{ status: "sent" | "skipped" | "error"; reason?: string } | null> {
  const currentYear = new Date().getUTCFullYear();

  // Detecta gaps similar ao detectRetroactiveGaps mas inline (sem dep cross-server)
  const yearEnd = `${currentYear}-12-31`;
  const todayMonth = new Date().toISOString().slice(0, 7);

  const [{ data: rules }, { data: txs }] = await Promise.all([
    admin
      .from("recurring_rules")
      .select("id, description, amount, start_date, end_date, frequency, kind")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .in("kind", ["income", "expense"])
      .lte("start_date", yearEnd),
    admin
      .from("transactions")
      .select("recurring_rule_id, date")
      .eq("household_id", householdId)
      .gte("date", `${currentYear}-01-01`)
      .lte("date", yearEnd)
      .not("recurring_rule_id", "is", null),
  ]);

  if (!rules) return null;

  const materializedByRule = new Map<string, Set<string>>();
  for (const t of txs ?? []) {
    const k = (t.recurring_rule_id as string) ?? null;
    if (!k) continue;
    const m = (t.date as string).slice(0, 7);
    if (!materializedByRule.has(k)) materializedByRule.set(k, new Set());
    materializedByRule.get(k)!.add(m);
  }

  let totalMissing = 0;
  for (const rule of rules) {
    if (rule.frequency !== "monthly") continue;
    const startMonth = (rule.start_date as string).slice(0, 7);
    const endMonth = rule.end_date
      ? (rule.end_date as string).slice(0, 7)
      : todayMonth;
    const effectiveStart = startMonth > `${currentYear}-01` ? startMonth : `${currentYear}-01`;
    const effectiveEnd = endMonth < todayMonth ? endMonth : todayMonth;

    let cursor = effectiveStart;
    const have = materializedByRule.get(rule.id as string) ?? new Set();
    while (cursor <= effectiveEnd) {
      if (!have.has(cursor)) totalMissing++;
      const [y, m] = cursor.split("-").map(Number);
      cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  }

  if (totalMissing === 0) return null;

  const subject = `IRPF/${currentYear}: ${totalMissing} lançamento(s) retroativo(s) pendentes`;
  const body = `Olá, ${name}.

Você tem ${totalMissing} lançamento(s) retroativo(s) faltando pra IR/${currentYear} ficar pronto em fev/${currentYear + 1}.

Esses são meses de recorrências (salário, dedutíveis) que começaram antes do marco zero do app e ainda não foram materializados como históricos.

Acesse /ir/${currentYear} e clique em "Preencher tudo" no banner amarelo pra cadastrar de uma vez.

— Finanças`;

  const r = await sendEmail({
    to: email,
    subject,
    body,
    notificationType: "ir_retroactive_gaps",
    relatedHouseholdId: householdId,
  });

  if (r.ok) {
    await admin
      .from("notification_preferences")
      .update({ ir_retroactive_gaps_last_sent: new Date().toISOString() })
      .eq("household_id", householdId);
  }

  return r.ok ? { status: "sent" } : { status: "error", reason: r.error };
}

async function sendMonthlyRecap(
  admin: AdminClient,
  householdId: string,
  email: string,
  name: string,
): Promise<{ status: "sent" | "skipped" | "error"; reason?: string } | null> {
  // Cobre o MÊS ANTERIOR (sempre mês fechado)
  const today = new Date();
  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const monthStr = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;

  let data: Awaited<ReturnType<typeof collectMonthlyData>>;
  try {
    data = await collectMonthlyData(householdId, monthStr);
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : String(e) };
  }

  // Não envia recap se não tem dados (mês vazio)
  if (data.income === 0 && data.expense === 0) {
    return { status: "skipped", reason: "Sem movimentação no mês." };
  }

  const ai = await generateMonthlyNarrative(data);
  if (!ai.ok) {
    return { status: "error", reason: ai.error };
  }

  const tmpl = tmplMonthlyNarrative({
    recipientName: name,
    monthLabel: data.monthLabel,
    title: ai.result.title,
    lead: ai.result.lead,
    paragraphs: ai.result.paragraphs,
    closing: ai.result.closing,
    highlights: ai.result.highlights,
  });

  await queueEmail({
    to: email,
    subject: tmpl.subject,
    body: tmpl.body,
    notificationType: "monthly_recap",
    relatedHouseholdId: householdId,
  });

  await admin
    .from("notification_preferences")
    .update({ monthly_recap_last_sent: new Date().toISOString() })
    .eq("household_id", householdId);

  return { status: "sent" };
}

/**
 * Avalia faturas de cartão e cria alertas no sino (user_facing=true) pra
 * fatura próxima do vencimento ou atrasada. Idempotente diário via
 * system_alerts.kind + context.due_date — se já tem alerta pra essa
 * fatura no mesmo dia, pula.
 *
 * Regras:
 *  - 3 dias antes do vencimento → alerta warning "vence em 3 dias"
 *  - 1 dia antes → alerta warning "vence amanhã"
 *  - Dia do vencimento → alerta warning "vence hoje"
 *  - Após vencimento (1+ dia) → alerta error "atrasada há N dias"
 *
 * Pagamento detectado pela soma de transfers PRA a conta-cartão no
 * período [closeDate, dueDate+30d] >= 95% do valor da fatura.
 */
async function checkCreditCardBills(
  admin: AdminClient,
  householdId: string,
): Promise<{ status: "sent" | "skipped" | "error"; reason?: string } | null> {
  // Cartões ativos com config de fatura
  type CardRow = {
    id: string;
    name: string;
    institution: string;
    bill_close_day: number;
    bill_due_day: number | null;
  };
  const { data: cards } = await (
    admin.from as unknown as (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => {
              not: (c: string, op: string, v: unknown) => Promise<{ data: CardRow[] | null }>;
            };
          };
        };
      };
    }
  )("accounts")
    .select("id, name, institution, bill_close_day, bill_due_day")
    .eq("household_id", householdId)
    .eq("type", "credit_card")
    .eq("is_active", true)
    .not("bill_close_day", "is", null);

  if (!cards || cards.length === 0) return null;

  let alerted = 0;
  const today = new Date();

  for (const card of cards) {
    const closeDay = card.bill_close_day;
    const dueDay = card.bill_due_day ?? closeDay;

    // Calcula janela atual e descobre a fatura anterior (que está pendente
    // até ser paga). Espelha a lógica de getOpenCreditCardBills sem importar
    // a função (evita ciclo de dependência).
    const current = computeBillWindow(closeDay, dueDay, today);
    const shiftMonths = (iso: string, n: number) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
    };
    const prevCloseDate = shiftMonths(current.closeDate, -1);
    const prevDueDate = shiftMonths(current.dueDate, -1);
    const prevPeriodStart = shiftMonths(current.periodStart, -1);
    const prevPeriodEnd = shiftMonths(current.periodEnd, -1);

    type Tx = { amount_account: string | number };
    const [{ data: expenses }, { data: payments }] = await Promise.all([
      (
        admin.from as unknown as (t: string) => {
          select: (s: string) => {
            eq: (c: string, v: unknown) => {
              eq: (c: string, v: unknown) => {
                gte: (c: string, v: unknown) => {
                  lte: (c: string, v: unknown) => Promise<{ data: Tx[] | null }>;
                };
              };
            };
          };
        }
      )("transactions")
        .select("amount_account")
        .eq("account_id", card.id)
        .eq("kind", "expense")
        .gte("date", prevPeriodStart)
        .lte("date", prevPeriodEnd),
      (
        admin.from as unknown as (t: string) => {
          select: (s: string) => {
            eq: (c: string, v: unknown) => {
              eq: (c: string, v: unknown) => {
                eq: (c: string, v: unknown) => {
                  gte: (c: string, v: unknown) => {
                    lte: (c: string, v: unknown) => Promise<{ data: Tx[] | null }>;
                  };
                };
              };
            };
          };
        }
      )("transactions")
        .select("amount_account")
        .eq("account_id", card.id)
        .eq("kind", "transfer")
        .eq("transfer_direction", "in")
        .gte("date", prevCloseDate)
        .lte("date", shiftMonths(prevDueDate, 0).slice(0, 7) + "-31"), // generoso
    ]);

    const billTotal = (expenses ?? []).reduce(
      (s, t) => s + Number(t.amount_account),
      0,
    );
    if (billTotal < 0.01) continue; // sem fatura anterior

    const paid = (payments ?? []).reduce(
      (s, t) => s + Number(t.amount_account),
      0,
    );
    if (paid >= billTotal * 0.95) continue; // já paga

    // Calcula daysUntilDue
    const todayISO = today.toISOString().slice(0, 10);
    const dueT = new Date(prevDueDate + "T00:00:00Z").getTime();
    const todayT = new Date(todayISO + "T00:00:00Z").getTime();
    const daysUntilDue = Math.round((dueT - todayT) / 86400000);

    // Decide severity e mensagem
    let severity: "warning" | "error";
    let userMessage: string;
    if (daysUntilDue < 0) {
      severity = "error";
      const overdue = Math.abs(daysUntilDue);
      userMessage = `Fatura do ${card.name} (${card.institution}) está atrasada há ${overdue} dia${overdue !== 1 ? "s" : ""}. Valor: R$ ${billTotal.toFixed(2).replace(".", ",")}.`;
    } else if (daysUntilDue === 0) {
      severity = "warning";
      userMessage = `Fatura do ${card.name} (${card.institution}) vence hoje. Valor: R$ ${billTotal.toFixed(2).replace(".", ",")}.`;
    } else if (daysUntilDue <= 3) {
      severity = "warning";
      userMessage = `Fatura do ${card.name} (${card.institution}) vence em ${daysUntilDue} dia${daysUntilDue !== 1 ? "s" : ""}. Valor: R$ ${billTotal.toFixed(2).replace(".", ",")}.`;
    } else {
      continue; // ainda longe pra alertar
    }

    // Dedup: não cria alerta duplicado pra mesma fatura no mesmo dia
    type Existing = { id: string };
    const { data: existing } = await (
      admin.from as unknown as (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => {
              gte: (c: string, v: unknown) => Promise<{ data: Existing[] | null }>;
            };
          };
        };
      }
    )("system_alerts")
      .select("id")
      .eq("kind", "credit_card_bill_due")
      .eq("household_id", householdId)
      .gte("created_at", todayISO);

    if (existing && existing.length > 0) continue;

    await (
      admin.from as unknown as (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
      }
    )("system_alerts").insert({
      kind: "credit_card_bill_due",
      message: `Fatura ${card.name} ${prevDueDate}: R$ ${billTotal.toFixed(2)} (${daysUntilDue} dias até vencer)`,
      severity,
      household_id: householdId,
      user_facing: true,
      user_message: userMessage,
      context: {
        account_id: card.id,
        due_date: prevDueDate,
        bill_total: billTotal,
        paid_amount: paid,
        days_until_due: daysUntilDue,
      },
    });
    alerted++;
  }

  if (alerted === 0) return { status: "skipped", reason: "Sem fatura próxima do vencimento." };
  return { status: "sent" };
}
