import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserContext } from "@/services/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateInSP, isBusinessDay } from "@/lib/financial/business-days";

/**
 * Override manual de saldos da RF — usado pra restaurar valores reais
 * vindos do broker (Tesouro Direto, conta CDB, etc) quando o cálculo
 * automático perde sincronia.
 *
 * Body JSON: { items: [{ ticker: string, balance: number, purchaseDate?: string }, ...] }
 * OU GET com query: ?ticker=XXX&balance=YYY (formato simplificado pra 1 ativo)
 *
 * Comportamento:
 *   - current_balance = balance (informado)
 *   - last_yield_at = último dia útil <= hoje (sem yield futuro em cima)
 *   - purchase_date opcionalmente atualizado (se informado)
 *
 * A partir daí, o cron diário continua aplicando Selic em cima desse
 * baseline. Sem drift, sem invenção.
 */
export const dynamic = "force-dynamic";

function lastBusinessDayOnOrBefore(iso: string): string {
  let cursor = iso;
  for (let i = 0; i < 30; i++) {
    if (isBusinessDay(cursor)) return cursor;
    const [y, m, d] = cursor.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    cursor = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  return iso;
}

type Item = { ticker: string; balance: number; purchaseDate?: string };

async function applyItems(householdId: string, items: Item[]) {
  const supabase = createAdminClient();
  const today = dateInSP(new Date()).iso;
  const lastBiz = lastBusinessDayOnOrBefore(today);

  const report: Array<{
    ticker: string;
    found: boolean;
    oldBalance?: number;
    newBalance?: number;
    newLastYieldAt?: string;
    newPurchaseDate?: string;
  }> = [];

  for (const it of items) {
    const { data: inv } = await supabase
      .from("investments")
      .select("id, ticker, current_balance, purchase_date")
      .eq("household_id", householdId)
      .eq("ticker", it.ticker)
      .eq("is_active", true)
      .maybeSingle();

    if (!inv) {
      report.push({ ticker: it.ticker, found: false });
      continue;
    }

    const update: {
      current_balance: number;
      last_yield_at: string;
      purchase_date?: string;
    } = {
      current_balance: Math.round(it.balance * 100) / 100,
      last_yield_at: lastBiz,
    };
    if (it.purchaseDate) update.purchase_date = it.purchaseDate;

    await supabase.from("investments").update(update).eq("id", inv.id);

    report.push({
      ticker: it.ticker,
      found: true,
      oldBalance: Number(inv.current_balance),
      newBalance: Math.round(it.balance * 100) / 100,
      newLastYieldAt: lastBiz,
      newPurchaseDate: it.purchaseDate,
    });
  }

  return { today, lastBiz, items: report };
}

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUserContext();
  if (!ctx) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker");
  const balanceStr = url.searchParams.get("balance");
  const purchaseDate = url.searchParams.get("purchaseDate") ?? undefined;

  if (!ticker || !balanceStr) {
    return NextResponse.json(
      { error: "Use ?ticker=XXX&balance=YYY ou POST com body JSON {items}" },
      { status: 400 },
    );
  }
  const balance = parseFloat(balanceStr);
  if (Number.isNaN(balance) || balance < 0) {
    return NextResponse.json({ error: "balance inválido" }, { status: 400 });
  }

  const result = await applyItems(ctx.household.id, [{ ticker, balance, purchaseDate }]);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUserContext();
  if (!ctx) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  if (!body?.items || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "Body precisa ser { items: [{ticker, balance, purchaseDate?}, ...] }" },
      { status: 400 },
    );
  }

  const result = await applyItems(ctx.household.id, body.items);
  return NextResponse.json({ ok: true, ...result });
}
