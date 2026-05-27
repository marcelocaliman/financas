import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  businessDaysSinceContinuous,
  dateInSP,
  isBusinessDay,
} from "@/lib/financial/business-days";

/**
 * Cron diário: checkpoint do current_balance da RF indexada.
 *
 * SEMÂNTICA (revisada — versão antiga tinha double-count com o live ticker):
 *
 *   - `last_yield_at` = "data até cujo FIM o current_balance inclui yield"
 *   - Cron baka apenas dias úteis COMPLETOS entre last_yield_at e hoje
 *     (exclusivo dos dois lados). NÃO pré-paga o dia corrente.
 *   - Live ticker adiciona a fração do dia atual em cima.
 *
 * Resultado:
 *   - Sem double-count (cron e live não pisam um no outro)
 *   - Pula fim de semana/feriado naturalmente (0 dias úteis = no-op)
 *   - Recupera dias perdidos se cron falhar (aplica (1+d)^N pra N dias)
 *
 * Schedule: chamado pelo daily-master após update-indexers.
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

  const now = new Date();
  const todayIso = dateInSP(now).iso;

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
    .select("id, current_balance, indexer, indexer_multiplier, last_yield_at, purchase_date")
    .eq("is_active", true)
    .in("indexer", ["selic", "cdi"]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let updated = 0;
  let skipped = 0;
  let touched = 0;

  for (const inv of actives ?? []) {
    const idx = inv.indexer as "selic" | "cdi";
    const annualPct = latest.get(idx);
    if (annualPct == null) continue;

    const lastYieldAt = inv.last_yield_at ?? inv.purchase_date;
    // Defensive: se last_yield já está hoje ou no futuro, nada a fazer
    if (lastYieldAt && lastYieldAt >= todayIso) {
      skipped++;
      continue;
    }

    // Conta dias úteis COMPLETOS desde last_yield_at até hoje (exclusivo dos dois).
    // Usa Math.floor pra descartar a fração do dia corrente — quem cuida dela
    // é o live ticker. Isso impede o double-count que a versão antiga tinha.
    const daysFloat = businessDaysSinceContinuous(lastYieldAt, now);
    const daysToAdd = Math.floor(daysFloat);

    if (daysToAdd <= 0) {
      // Nenhum dia útil completo desde o último checkpoint (típico em fins de
      // semana ou no dia útil corrente antes do fechamento). No-op.
      skipped++;
      continue;
    }

    const multiplier = Number(inv.indexer_multiplier ?? 1);
    const effectiveAnnual = (annualPct * multiplier) / 100;
    const daily = Math.pow(1 + effectiveAnnual, 1 / 252) - 1;
    const factor = Math.pow(1 + daily, daysToAdd);
    const newBalance = Math.round(Number(inv.current_balance) * factor * 100) / 100;

    // last_yield_at recebe a data do ÚLTIMO dia útil completo baked, pra o
    // live calc adicionar daí pra frente (incluindo dias úteis subsequentes
    // ainda não bakeados + fração do dia corrente).
    const lastBaked = findLastCompletedBusinessDay(lastYieldAt, now);

    await supabase
      .from("investments")
      .update({ current_balance: newBalance, last_yield_at: lastBaked })
      .eq("id", inv.id);
    updated++;
    touched += daysToAdd;
  }

  return NextResponse.json({
    ok: true,
    updated,
    skipped,
    daysBakedTotal: touched,
    todayIsBusinessDay: isBusinessDay(now),
  });
}

/**
 * Acha o ÚLTIMO dia útil completo entre `fromIso` (exclusive) e `now`
 * (exclusive — pq o dia corrente não está completo). Usado pra atualizar
 * `last_yield_at` após o cron bakar yields.
 *
 * Estratégia: itera dos candidatos (today-1, today-2, ...) até achar um
 * dia útil que seja > fromIso.
 */
function findLastCompletedBusinessDay(fromIso: string, now: Date): string {
  const today = dateInSP(now);
  const cursor = new Date(Date.UTC(today.y, today.m - 1, today.d));
  // Começa em ontem
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let i = 0; i < 30; i++) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso <= fromIso) break; // não voltamos antes do checkpoint anterior
    if (isBusinessDay(iso)) return iso;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  // Fallback: mantém checkpoint (não deveria acontecer)
  return fromIso;
}
