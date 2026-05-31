import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeJson } from "@/lib/external/resilient-fetch";
import type { Database, Currency } from "@/types/database";

/**
 * Cron diário: busca taxas de câmbio do Frankfurter (ECB) e atualiza `currency_rates`.
 *
 * Schedule (vercel.json): `30 10 * * *` (07h30 BRT, depois dos outros crons).
 *
 * Frankfurter é grátis, sem auth, fonte ECB. Ele só responde com base != quote,
 * então sempre buscamos `?from=X&to=Y`. Pares: BRL↔EUR, BRL↔USD, EUR↔USD.
 *
 * Identidades (BRL→BRL = 1) são tratadas no client em buildRateMap.
 */
export const dynamic = "force-dynamic";

const PAIRS: Array<[Currency, Currency]> = [
  ["BRL", "EUR"], ["EUR", "BRL"],
  ["BRL", "USD"], ["USD", "BRL"],
  ["BRL", "GBP"], ["GBP", "BRL"],
  ["EUR", "USD"], ["USD", "EUR"],
  ["EUR", "GBP"], ["GBP", "EUR"],
  ["USD", "GBP"], ["GBP", "USD"],
];

async function fetchRate(from: Currency, to: Currency): Promise<{ date: string; rate: number } | null> {
  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
  // resilient: timeout + retry; degrada (null) em vez de pendurar a invocação.
  const r = await safeJson<{ date: string; rates: Record<string, number> }>(url, {
    label: "frankfurter",
    timeoutMs: 8000,
  });
  if (!r.ok) return null;
  const rate = r.data.rates?.[to];
  if (!rate || rate <= 0) return null;
  return { date: r.data.date, rate };
}

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

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const results: Record<string, { date: string; rate: number } | null> = {};
  for (const [from, to] of PAIRS) {
    const latest = await fetchRate(from, to);
    const key = `${from}→${to}`;
    results[key] = latest;
    if (latest) {
      // fetched_at no payload pra health check refletir execução do cron
      // (sem isso, created_at fica parado se a taxa não mudou no dia)
      // Cast: coluna fetched_at adicionada via migration 20260527030000, types não regenerados
      const { error } = await (supabase.from("currency_rates") as unknown as {
        upsert: (data: object, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
      }).upsert(
        {
          base: from,
          quote: to,
          date: latest.date,
          rate: latest.rate,
          source: "frankfurter",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "base,quote,date" },
      );
      if (error) {
        // Degrada: um par com erro não aborta o batch inteiro.
        results[key] = null;
      }
    }
  }

  return NextResponse.json({ ok: true, updated: results });
}
