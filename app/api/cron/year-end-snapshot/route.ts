import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Snapshot anual de saldos pra `ir_prior_year_balances`.
 *
 * Roda dentro do master cron diário, mas só age em 02/janeiro — captura o
 * estado do ano anterior ANTES que rendimentos/movimentações comecem a
 * alterar saldos. (Dia 1 pode estar feriado/pré-aplicação de rendimentos
 * de 31/12, dia 2 é mais seguro.)
 *
 * Pra cada household, fotografa:
 *  - Investimentos ativos: current_balance → ir_prior_year_balances
 *  - Contas ativas: current_balance → ir_prior_year_balances
 *  - Bens físicos ativos: current_value → ir_prior_year_balances
 *
 * Idempotente — usa upsert na constraint única (entity_id, year).
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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Só age em 02/janeiro (SP). Em qualquer outro dia, no-op silencioso.
  const now = new Date();
  const spDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const month = Number(spDate.find((p) => p.type === "month")?.value ?? 0);
  const day = Number(spDate.find((p) => p.type === "day")?.value ?? 0);
  const currentYear = Number(spDate.find((p) => p.type === "year")?.value ?? 0);

  // Permite override via query (?force=1) pra teste manual
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  if (!force && (month !== 1 || day !== 2)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Hoje ${day}/${month} — só roda em 02/01.`,
    });
  }

  const yearToSnapshot = currentYear - 1;
  const admin = createAdminClient();

  // Lista todos os households ativos
  const { data: households } = await admin.from("households").select("id");
  if (!households) {
    return NextResponse.json({ error: "Falha ao listar households" }, { status: 500 });
  }

  let totalSnapshotted = 0;
  const perHousehold: Array<{ id: string; counts: { inv: number; acc: number; phys: number } }> = [];

  for (const h of households) {
    const counts = { inv: 0, acc: 0, phys: 0 };

    // ─── Investimentos ─────────────────────────────────────────
    const { data: investments } = await admin
      .from("investments")
      .select("id, current_balance")
      .eq("household_id", h.id)
      .eq("is_active", true);
    if (investments && investments.length > 0) {
      const rows = investments.map((i) => ({
        household_id: h.id,
        year: yearToSnapshot,
        investment_id: i.id,
        balance: Number(i.current_balance ?? 0),
        notes: `Snapshot automático em ${now.toISOString().slice(0, 10)}`,
      }));
      const { error } = await admin
        .from("ir_prior_year_balances")
        .upsert(rows, { onConflict: "investment_id,year", ignoreDuplicates: false });
      if (!error) counts.inv = rows.length;
    }

    // ─── Contas ────────────────────────────────────────────────
    // RECONSTRÓI o saldo de 31/12 (não o saldo live de 02/01): reverte as
    // transações JÁ APLICADAS com data depois de 31/12 (FIN-14). Sem isso, o
    // snapshot do ano-base incluiria movimentos de 01–02/jan.
    const yearEndIso = `${yearToSnapshot}-12-31`;
    const { data: accounts } = await admin
      .from("accounts")
      .select("id, current_balance")
      .eq("household_id", h.id)
      .eq("is_active", true);
    const { data: postYearTxs } = await admin
      .from("transactions")
      .select("account_id, kind, amount_account, transfer_direction")
      .eq("household_id", h.id)
      .eq("is_historical_ir_only", false)
      .not("balance_applied_at", "is", null)
      .gt("date", yearEndIso);
    const deltaByAccount = new Map<string, number>();
    for (const t of (postYearTxs ?? []) as Array<{
      account_id: string;
      kind: "income" | "expense" | "transfer";
      amount_account: number;
      transfer_direction: "in" | "out" | null;
    }>) {
      const amt = Number(t.amount_account ?? 0);
      let delta = 0;
      if (t.kind === "income") delta = amt;
      else if (t.kind === "expense") delta = -amt;
      else if (t.kind === "transfer") delta = t.transfer_direction === "in" ? amt : t.transfer_direction === "out" ? -amt : 0;
      deltaByAccount.set(t.account_id, (deltaByAccount.get(t.account_id) ?? 0) + delta);
    }
    if (accounts && accounts.length > 0) {
      const rows = accounts.map((a) => ({
        household_id: h.id,
        year: yearToSnapshot,
        account_id: a.id,
        // saldo_31/12 = saldo_atual − deltas aplicados depois de 31/12
        balance:
          Math.round((Number(a.current_balance ?? 0) - (deltaByAccount.get(a.id) ?? 0)) * 100) / 100,
        notes: `Snapshot reconstruído de ${yearEndIso}`,
      }));
      const { error } = await admin
        .from("ir_prior_year_balances")
        .upsert(rows, { onConflict: "account_id,year", ignoreDuplicates: false });
      if (!error) counts.acc = rows.length;
    }

    // ─── Bens físicos ──────────────────────────────────────────
    const { data: physical } = await admin
      .from("physical_assets")
      .select("id, current_value")
      .eq("household_id", h.id)
      .eq("is_active", true);
    if (physical && physical.length > 0) {
      const rows = physical.map((p) => ({
        household_id: h.id,
        year: yearToSnapshot,
        physical_asset_id: p.id,
        balance: Number(p.current_value ?? 0),
        notes: `Snapshot automático em ${now.toISOString().slice(0, 10)}`,
      }));
      const { error } = await admin
        .from("ir_prior_year_balances")
        .upsert(rows, { onConflict: "physical_asset_id,year", ignoreDuplicates: false });
      if (!error) counts.phys = rows.length;
    }

    totalSnapshotted += counts.inv + counts.acc + counts.phys;
    perHousehold.push({ id: h.id, counts });
  }

  return NextResponse.json({
    ok: true,
    yearSnapshotted: yearToSnapshot,
    totalEntries: totalSnapshotted,
    households: perHousehold.length,
    detail: perHousehold,
  });
}
