import { NextResponse, type NextRequest } from "next/server";
import { executePendingDeletions } from "@/services/lgpd-deletion.actions";

/**
 * Cron diário: executa as exclusões de conta cujo grace (LGPD_DELETION_GRACE_DAYS)
 * expirou. Engatilhado — agendar em vercel.json na consolidação de crons.
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
  const result = await executePendingDeletions();
  return NextResponse.json(result);
}
