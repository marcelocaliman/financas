import { NextResponse, type NextRequest } from "next/server";

/**
 * Master cron diário — Vercel Hobby permite só 2 cron schedules, então
 * consolida vários jobs em um só. Dispara cada endpoint via fetch interno
 * (com CRON_SECRET) em paralelo ou série conforme dependências.
 *
 * Schedule: `0 9 * * *` (09h UTC = 06h BRT) — antes do usuário abrir o app.
 *
 * Jobs executados (ordem):
 *   1. advance-balances (aplica deltas de transações pré-agendadas)
 *   2. materialize-recurrences (cria transactions das regras recorrentes)
 *   3. Paralelo: update-indexers + update-rates (benchmark Selic/CDI/IPCA + FX)
 *   4. sync-tesouro-prices (PU oficial → atualiza current_balance de Tesouros)
 *   5. snapshot-patrimonio (só roda no dia 1 do mês — verificação interna)
 *   6. year-end-snapshot (só age em 02/janeiro)
 *   7. send-pending-emails (drena fila)
 *   8. health-check (verifica se algo ficou stale e alerta)
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
      // Não chamar com cache
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
      { error: "CRON_SECRET não configurado — necessário pro auth interno" },
      { status: 500 },
    );
  }

  // Base URL pro fetch interno. Em produção VERCEL_URL é set.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!baseUrl) {
    return NextResponse.json(
      { error: "URL base não disponível (NEXT_PUBLIC_APP_URL ou VERCEL_URL)" },
      { status: 500 },
    );
  }

  // Vercel Hobby = 10s timeout. Paralelizamos em ondas pra caber.
  // ORDEM IMPORTA: o snapshot de patrimônio precisa rodar DEPOIS de
  // sync-tesouro-prices/update-rates/update-indexers (que atualizam
  // current_balance e taxas), senão congela preços/câmbio defasados em 1 dia.
  const wave1 = await Promise.all([
    callEndpoint(baseUrl, "/api/cron/advance-balances", secret),
    callEndpoint(baseUrl, "/api/cron/materialize-recurrences", secret),
    callEndpoint(baseUrl, "/api/cron/update-indexers", secret),
    callEndpoint(baseUrl, "/api/cron/update-rates", secret),
    callEndpoint(baseUrl, "/api/cron/send-pending-emails", secret),
  ]);
  const wave2 = await Promise.all([
    callEndpoint(baseUrl, "/api/cron/sync-tesouro-prices", secret),
  ]);
  // Snapshots leem investments.current_balance e taxas já atualizados acima.
  const wave3 = await Promise.all([
    callEndpoint(baseUrl, "/api/cron/snapshot-patrimonio", secret),
    callEndpoint(baseUrl, "/api/cron/year-end-snapshot", secret),
  ]);
  const wave4 = await Promise.all([
    callEndpoint(baseUrl, "/api/cron/health-check", secret),
  ]);

  const results = [...wave1, ...wave2, ...wave3, ...wave4];
  const wallMs =
    Math.max(...wave1.map((r) => r.ms)) +
    Math.max(...wave2.map((r) => r.ms)) +
    Math.max(...wave3.map((r) => r.ms)) +
    Math.max(...wave4.map((r) => r.ms));
  const allOk = results.every((r) => r.ok);

  return NextResponse.json({
    ok: allOk,
    wallMs,
    jobs: results,
  });
}
