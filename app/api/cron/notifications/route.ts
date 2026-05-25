import { NextResponse, type NextRequest } from "next/server";
import { runDailyNotifications } from "@/services/notifications";

/**
 * Cron diário: avalia condições e envia notificações por email
 * (DARF vencendo, lacunas IR retroativas, etc.).
 *
 * Schedule sugerido: `0 13 * * *` (10h BRT, depois dos snapshots).
 *
 * Idempotência: cada notificação usa carimbo last_sent na tabela
 * notification_preferences pra evitar spam.
 */
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await runDailyNotifications();
    const summary = {
      total: results.length,
      sent: results.filter((r) => r.status === "sent").length,
      errors: results.filter((r) => r.status === "error").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    };
    return NextResponse.json({ ok: true, summary, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
