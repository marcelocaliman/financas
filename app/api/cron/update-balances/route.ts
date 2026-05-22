import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cron diário: aplica rendimento da Selic/CDI a todos os ativos indexados
 * de todos os households. Chamado depois do update-indexers.
 *
 * Schedule recomendado:
 *   { "path": "/api/cron/update-balances", "schedule": "15 10 * * *" }
 *
 * Para cada ativo com indexer in ('selic', 'cdi'), aplica a taxa diária
 * composta usando o último valor do índice em indexer_history.
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

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Lê últimos valores
  const { data: indexers } = await supabase
    .from("indexer_history")
    .select("indexer, value, date")
    .order("date", { ascending: false });

  const latest = new Map<string, number>();
  for (const row of indexers ?? []) {
    if (!latest.has(row.indexer)) latest.set(row.indexer, Number(row.value));
  }

  const { data: actives, error } = await supabase
    .from("investments")
    .select("id, current_balance, indexer, indexer_multiplier")
    .eq("is_active", true)
    .in("indexer", ["selic", "cdi"]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let updated = 0;
  for (const inv of actives ?? []) {
    const idx = inv.indexer as "selic" | "cdi";
    const annualPct = latest.get(idx);
    if (annualPct == null) continue;
    const multiplier = Number(inv.indexer_multiplier ?? 1);
    const effectiveAnnual = (annualPct * multiplier) / 100;
    const daily = Math.pow(1 + effectiveAnnual, 1 / 252) - 1;
    const newBalance = Math.round(Number(inv.current_balance) * (1 + daily) * 100) / 100;
    await supabase
      .from("investments")
      .update({ current_balance: newBalance, last_yield_at: new Date().toISOString().slice(0, 10) })
      .eq("id", inv.id);
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
