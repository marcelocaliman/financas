import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  ["BRL", "EUR"],
  ["EUR", "BRL"],
  ["BRL", "USD"],
  ["USD", "BRL"],
  ["EUR", "USD"],
  ["USD", "EUR"],
];

async function fetchRate(from: Currency, to: Currency): Promise<{ date: string; rate: number } | null> {
  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const json = (await res.json()) as { date: string; rates: Record<string, number> };
  const rate = json.rates?.[to];
  if (!rate || rate <= 0) return null;
  return { date: json.date, rate };
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
      const { error } = await supabase.from("currency_rates").upsert(
        {
          base: from,
          quote: to,
          date: latest.date,
          rate: latest.rate,
          source: "frankfurter",
        },
        { onConflict: "base,quote,date" },
      );
      if (error) {
        return NextResponse.json({ ok: false, pair: key, error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, updated: results });
}
