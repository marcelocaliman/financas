import { NextResponse, type NextRequest } from "next/server";
import { isStripeConfigured } from "@/lib/stripe";
import { runBillingDunning } from "@/services/billing-dunning";

/**
 * Cron diário de dunning (D19). No-op se o billing não estiver configurado.
 * Engatilhado — agendar em vercel.json junto da consolidação de crons.
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
  if (!isStripeConfigured()) {
    return NextResponse.json({ skipped: "billing não configurado" });
  }
  const result = await runBillingDunning();
  return NextResponse.json(result);
}
