import { NextResponse, type NextRequest } from "next/server";

/**
 * Master de fim de dia útil (Vercel Hobby = 2 crons max).
 *
 * Schedule: `30 21 * * 1-5` (21:30 UTC = 18:30 BRT, seg-sex)
 *
 * Dispara depois do fechamento do pregão pra ter cotações reais do dia.
 *
 * Jobs:
 *   1. snapshot-quotes (brapi.dev — preços de fechamento dos ativos)
 *   2. send-pending-emails (drena fila — segundo passe do dia)
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

async function callEndpoint(
  baseUrl: string,
  path: string,
  secret: string,
): Promise<{ path: string; ok: boolean; status: number; ms: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    return {
      path,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - start,
      error: res.ok ? undefined : await res.text().catch(() => "unknown"),
    };
  } catch (e) {
    return {
      path,
      ok: false,
      status: 0,
      ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!baseUrl) {
    return NextResponse.json(
      { error: "URL base não disponível" },
      { status: 500 },
    );
  }

  const results: Array<{ path: string; ok: boolean; status: number; ms: number; error?: string }> = [];

  // 1) Snapshot brapi pós-fechamento
  results.push(await callEndpoint(baseUrl, "/api/cron/snapshot-quotes", secret));

  // 2) Drena fila de emails
  results.push(await callEndpoint(baseUrl, "/api/cron/send-pending-emails", secret));

  const totalMs = results.reduce((s, r) => s + r.ms, 0);
  const allOk = results.every((r) => r.ok);

  return NextResponse.json({
    ok: allOk,
    totalMs,
    jobs: results,
  });
}
