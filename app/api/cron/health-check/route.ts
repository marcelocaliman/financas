import { NextResponse, type NextRequest } from "next/server";
import { getCronStatuses } from "@/services/cron-status";
import { queueEmail, tmplCronStale } from "@/services/email";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron diário: verifica se algum cron job está stale e dispara email pro
 * platform admin (ou CRON_ALERT_EMAIL no env).
 *
 * Idempotência: usa email_notifications_log pra evitar spam — só envia se
 * NÃO houve alerta nas últimas 20 horas (proteção contra rodar 2x/dia).
 *
 * Schedule: `0 12 * * *` (09h BRT) — depois dos outros crons rodarem.
 */
export const dynamic = "force-dynamic";

const ALERT_DEDUP_HOURS = 20;
const NOTIFICATION_TYPE = "cron_stale_alert";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

async function findRecipientEmail(): Promise<string | null> {
  const envEmail = process.env.CRON_ALERT_EMAIL?.trim();
  if (envEmail) return envEmail;

  // Fallback: primeiro platform admin
  const admin = createAdminClient();
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .limit(1)
    .maybeSingle();
  if (!platformAdmin?.user_id) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(
    platformAdmin.user_id,
  );
  return authUser?.user?.email ?? null;
}

async function alertedRecently(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - ALERT_DEDUP_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { data } = await admin
    .from("email_notifications_log")
    .select("id")
    .eq("recipient_email", email)
    .eq("notification_type", NOTIFICATION_TYPE)
    .gte("created_at", cutoff)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const statuses = await getCronStatuses();
  const stale = statuses.filter((s) => s.status === "stale" || s.status === "missing");

  if (stale.length === 0) {
    return NextResponse.json({ ok: true, stale: 0, alerted: false });
  }

  const email = await findRecipientEmail();
  if (!email) {
    return NextResponse.json(
      { ok: false, stale: stale.length, error: "No recipient email (set CRON_ALERT_EMAIL)" },
      { status: 200 },
    );
  }

  // Dedup: já alertou nas últimas 20h?
  if (await alertedRecently(email)) {
    return NextResponse.json({
      ok: true,
      stale: stale.length,
      alerted: false,
      reason: "deduplicated (alert sent within last 20h)",
    });
  }

  const tmpl = tmplCronStale({
    staleChecks: stale.map((s) => ({
      name: s.name,
      description: s.description,
      ageHours: s.ageHours ?? 9999,
      staleAfterHours: s.staleAfterHours,
    })),
  });

  await queueEmail({
    to: email,
    subject: tmpl.subject,
    body: tmpl.body,
    notificationType: NOTIFICATION_TYPE,
  });

  return NextResponse.json({
    ok: true,
    stale: stale.length,
    alerted: true,
    recipient: email,
  });
}
