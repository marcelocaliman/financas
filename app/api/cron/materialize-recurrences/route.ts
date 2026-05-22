import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cron diário: materializa as recorrências vencidas até hoje pra todos os households.
 *
 * Schedule (vercel.json): `45 9 * * *` — 06h45 BRT, antes dos outros crons.
 *
 * Como funciona:
 * 1. Lista households distintos com recurring_rules ativas.
 * 2. Pra cada um, chama materialize_all_recurrences(household, today).
 *
 * Auth: x-vercel-cron OU Authorization: Bearer $CRON_SECRET.
 */
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = todayISO();

  const { data: rules, error: listErr } = await supabase
    .from("recurring_rules")
    .select("household_id")
    .eq("is_active", true);

  if (listErr) {
    return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 });
  }

  const households = Array.from(new Set((rules ?? []).map((r) => r.household_id)));

  let total = 0;
  const perHousehold: Record<string, number> = {};
  for (const hh of households) {
    const { data, error } = await supabase.rpc("materialize_all_recurrences", {
      p_household_id: hh,
      p_until_date: today,
    });
    if (error) {
      return NextResponse.json({ ok: false, household: hh, error: error.message }, { status: 500 });
    }
    perHousehold[hh] = data ?? 0;
    total += data ?? 0;
  }

  return NextResponse.json({ ok: true, until: today, total, households: perHousehold });
}
