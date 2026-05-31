import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail, tmplBillingPastDue, tmplBillingSuspended } from "@/services/email";
import { logger } from "@/lib/logger";

/**
 * Dunning: gerencia inadimplência (D19). Roda diário.
 *  - past_due há >= SUSPEND_DAYS → suspende (somente-leitura) + e-mail.
 *  - past_due em D+1/D+3/D+7 → e-mail de lembrete.
 * Nunca mexe em households com override manual (lifetime/comp).
 */

const SUSPEND_DAYS = 10; // grace antes de suspender
const REMINDER_DAYS = new Set([1, 3, 7]);

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

async function adminEmailFor(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
): Promise<string | null> {
  const { data: members } = await admin
    .from("users")
    .select("id, role")
    .eq("household_id", householdId)
    .eq("role", "admin")
    .limit(1);
  const adminUser = members?.[0];
  if (!adminUser) return null;
  const { data } = await admin.auth.admin.getUserById(adminUser.id);
  return data?.user?.email ?? null;
}

export async function runBillingDunning(): Promise<{
  checked: number;
  suspended: number;
  reminded: number;
}> {
  const admin = createAdminClient();
  const { data: overdue } = await admin
    .from("households")
    .select("id, past_due_since")
    .eq("subscription_status", "past_due")
    .eq("subscription_manual_override", false)
    .not("past_due_since", "is", null);

  let suspended = 0;
  let reminded = 0;
  const rows = overdue ?? [];

  for (const hh of rows) {
    if (!hh.past_due_since) continue;
    const days = daysSince(hh.past_due_since);
    const email = await adminEmailFor(admin, hh.id);

    if (days >= SUSPEND_DAYS) {
      await admin
        .from("households")
        .update({ subscription_status: "suspended" })
        .eq("id", hh.id)
        .eq("subscription_manual_override", false);
      suspended += 1;
      if (email) {
        const t = tmplBillingSuspended();
        await queueEmail({
          to: email,
          subject: t.subject,
          body: t.body,
          notificationType: "billing_suspended",
          relatedHouseholdId: hh.id,
        });
      }
      logger.info("billing: household suspenso por inadimplência", { householdId: hh.id, days });
    } else if (REMINDER_DAYS.has(days) && email) {
      const t = tmplBillingPastDue({ daysOverdue: days, graceDays: SUSPEND_DAYS });
      await queueEmail({
        to: email,
        subject: t.subject,
        body: t.body,
        notificationType: "billing_past_due",
        relatedHouseholdId: hh.id,
      });
      reminded += 1;
    }
  }

  return { checked: rows.length, suspended, reminded };
}
