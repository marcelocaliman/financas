import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserContext } from "@/services/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateInSP, isBusinessDay } from "@/lib/financial/business-days";

/**
 * Endpoint one-shot: recalcula `current_balance` e `last_yield_at` da RF
 * indexada (Selic/CDI) usando o histórico REAL do BCB.
 *
 * Para cada ativo:
 *   1. Busca série da Selic Meta (BCB SGS 432) ou CDI (SGS 4389) cobrindo
 *      [purchase_date, ontem]
 *   2. Pra cada dia útil no range, acha a taxa vigente naquele dia
 *      (Copom altera apenas em datas pontuais — usa step function)
 *   3. Multiplica initial_amount por ∏(1 + daily_t) pra obter o saldo correto
 *   4. Aplica multiplier do ativo (caso seja, ex, 100% CDI)
 *   5. Update {current_balance, last_yield_at = ontem-útil}
 *
 * Resultado: zera qualquer drift acumulado pelos bugs do cron antigo
 * (double-count em dia útil + yield fantasma em fim de semana).
 *
 * Modo dry-run (default): só retorna o relatório, não escreve.
 * Pra aplicar, passe ?apply=1.
 *
 * NOTA: assume que initial_amount + purchase_date refletem capital de entrada.
 * Se o usuário fez add_to_fixed_income depois, o aporte foi somado em ambos,
 * então o recompute pode SUPERESTIMAR (trataria o capital adicionado como
 * se estivesse rendendo desde o início). Pra o caso comum sem aportes
 * intermediários, o resultado é matematicamente correto.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type BcbPoint = { data: string; valor: string };
type RateChange = { fromIso: string; annualPct: number };

async function fetchBCBSeries(
  series: number,
  fromIso: string,
  toIso: string,
): Promise<RateChange[]> {
  // BCB SGS aceita formato dd/mm/yyyy nos params
  const [fy, fm, fd] = fromIso.split("-");
  const [ty, tm, td] = toIso.split("-");
  const params = new URLSearchParams({
    formato: "json",
    dataInicial: `${fd}/${fm}/${fy}`,
    dataFinal: `${td}/${tm}/${ty}`,
  });
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados?${params}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`BCB SGS ${series} falhou (${res.status})`);
  const json = (await res.json()) as BcbPoint[];
  return json.map((p) => {
    const [dd, mm, yyyy] = p.data.split("/");
    return {
      fromIso: `${yyyy}-${mm}-${dd}`,
      annualPct: parseFloat(p.valor.replace(",", ".")),
    };
  });
}

/** Encontra a taxa anual vigente numa data ISO usando step function das mudanças. */
function rateOn(date: string, changes: RateChange[]): number | null {
  // changes ordenado asc por fromIso
  let active: number | null = null;
  for (const c of changes) {
    if (c.fromIso <= date) active = c.annualPct;
    else break;
  }
  return active;
}

function isoForDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Avança 1 dia em UTC e retorna ISO. */
function nextIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return isoForDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Acha o último dia útil <= referenceIso. */
function lastBusinessDayOnOrBefore(referenceIso: string): string {
  let cursor = referenceIso;
  for (let i = 0; i < 30; i++) {
    if (isBusinessDay(cursor)) return cursor;
    // Volta 1 dia
    const [y, m, d] = cursor.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    cursor = isoForDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return referenceIso;
}

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }
  const apply = new URL(req.url).searchParams.get("apply") === "1";
  const supabase = createAdminClient();

  const { data: rfAssets, error } = await supabase
    .from("investments")
    .select(
      "id, ticker, name, indexer, indexer_multiplier, purchase_date, initial_amount, current_balance, last_yield_at, currency",
    )
    .eq("household_id", ctx.household.id)
    .eq("is_active", true)
    .in("indexer", ["selic", "cdi"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!rfAssets || rfAssets.length === 0) {
    return NextResponse.json({ ok: true, message: "Sem ativos RF indexados", recomputed: [] });
  }

  // Acha range global pra buscar BCB uma única vez por série
  const today = dateInSP(new Date()).iso;
  const yesterdayBiz = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return lastBusinessDayOnOrBefore(
      isoForDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()),
    );
  })();

  const earliestPurchase = rfAssets
    .map((a) => a.purchase_date)
    .filter(Boolean)
    .sort()[0]!;

  // Busca histórico do BCB cobrindo o range mais amplo
  const seriesNeeded = new Set(rfAssets.map((a) => a.indexer as "selic" | "cdi"));
  const ratesBySeries = new Map<string, RateChange[]>();
  for (const s of seriesNeeded) {
    const code = s === "selic" ? 432 : 4389;
    try {
      const series = await fetchBCBSeries(code, earliestPurchase, today);
      ratesBySeries.set(s, series);
    } catch (e) {
      return NextResponse.json(
        { error: `Falha ao buscar BCB ${s}: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 },
      );
    }
  }

  // Replica yield day-by-day pra cada ativo
  const report: Array<{
    id: string;
    ticker: string;
    name: string;
    purchaseDate: string;
    initialAmount: number;
    oldCurrentBalance: number;
    newCurrentBalance: number;
    delta: number;
    deltaPct: number;
    oldLastYieldAt: string | null;
    newLastYieldAt: string;
    businessDaysApplied: number;
  }> = [];

  for (const inv of rfAssets) {
    if (!inv.purchase_date) continue;
    const series = ratesBySeries.get(inv.indexer as string);
    if (!series) continue;

    const multiplier = Number(inv.indexer_multiplier ?? 1);
    let balance = Number(inv.initial_amount);

    // Itera dia a dia de (purchase_date + 1) até yesterdayBiz (inclusive)
    // Aplica yield só em dias úteis, usando a Selic vigente naquele dia
    let cursor = nextIso(inv.purchase_date);
    let daysApplied = 0;
    while (cursor <= yesterdayBiz) {
      if (isBusinessDay(cursor)) {
        const annualPct = rateOn(cursor, series);
        if (annualPct != null) {
          const effectiveAnnual = (annualPct * multiplier) / 100;
          const daily = Math.pow(1 + effectiveAnnual, 1 / 252) - 1;
          balance = balance * (1 + daily);
          daysApplied++;
        }
      }
      cursor = nextIso(cursor);
    }

    const newBalance = Math.round(balance * 100) / 100;
    const oldBalance = Number(inv.current_balance);

    report.push({
      id: inv.id,
      ticker: inv.ticker,
      name: inv.name,
      purchaseDate: inv.purchase_date,
      initialAmount: Number(inv.initial_amount),
      oldCurrentBalance: oldBalance,
      newCurrentBalance: newBalance,
      delta: Math.round((newBalance - oldBalance) * 100) / 100,
      deltaPct: oldBalance > 0
        ? Math.round(((newBalance - oldBalance) / oldBalance) * 10000) / 100
        : 0,
      oldLastYieldAt: inv.last_yield_at,
      newLastYieldAt: yesterdayBiz,
      businessDaysApplied: daysApplied,
    });
  }

  // Se apply=1, aplica os updates
  if (apply) {
    for (const r of report) {
      await supabase
        .from("investments")
        .update({
          current_balance: r.newCurrentBalance,
          last_yield_at: r.newLastYieldAt,
        })
        .eq("id", r.id);
    }
  }

  return NextResponse.json({
    ok: true,
    applied: apply,
    today,
    yesterdayBiz,
    count: report.length,
    totalOldBalance: Math.round(report.reduce((s, r) => s + r.oldCurrentBalance, 0) * 100) / 100,
    totalNewBalance: Math.round(report.reduce((s, r) => s + r.newCurrentBalance, 0) * 100) / 100,
    totalDelta: Math.round(report.reduce((s, r) => s + r.delta, 0) * 100) / 100,
    items: report,
  });
}
