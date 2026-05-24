import { NextResponse, type NextRequest } from "next/server";
import { drainEmailQueue } from "@/services/email";

/**
 * Cron: drena fila de emails pendentes.
 *
 * Schedule sugerido (vercel.json): cada 5 minutos `*​/5 * * * *`
 * (subir manualmente em vercel.json quando ativar Resend).
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
  const result = await drainEmailQueue(100);
  return NextResponse.json(result);
}
