import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Currency, Database } from "@/types/database";

/**
 * Cron diário: snapshot do patrimônio de cada household marcado pelo
 * último dia do MÊS CORRENTE. Roda dentro do daily-master.
 *
 * Como funciona:
 *  - Cada execução faz UPSERT por (household_id, current_month_end)
 *  - Durante o mês, a linha é sobrescrita diariamente com o estado atual
 *  - Quando o mês vira (dia 1), insere nova linha pro novo mês — a linha
 *    do mês anterior fica "congelada" automaticamente com a última escrita
 *    (estado de jogo do último dia do mês)
 *  - Resultado: histórico real do patrimônio mês a mês pra sparkline 12m
 *
 * Idempotente. Pode rodar várias vezes no mesmo dia.
 */
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

type AccountRow = {
  household_id: string;
  type: "checking" | "savings" | "credit_card" | "investment" | "cash";
  current_balance: number;
  currency: Currency;
};
type InvestmentRow = {
  household_id: string;
  current_balance: number;
  currency: Currency;
  asset_type: string;
};
type PhysicalRow = {
  household_id: string;
  current_value: number;
};

// Conversão simplificada — assume BRL como exibição padrão dos snapshots.
// (Os dashboards de display continuam convertendo per-user via getRateMap.)
function currentMonthEnd(now: Date): string {
  // Último dia do mês CORRENTE em UTC.
  // new Date(year, month+1, 0) retorna o último dia do mês `month` (0-indexed).
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const monthEnd = currentMonthEnd(new Date());

  // Lê contas, investimentos e bens — agrupa por household
  const [{ data: accounts }, { data: investments }, { data: physicals }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("household_id, type, current_balance, currency")
        .eq("is_active", true),
      supabase
        .from("investments")
        .select("household_id, current_balance, currency, asset_type")
        .eq("is_active", true),
      supabase
        .from("physical_assets")
        .select("household_id, current_value")
        .eq("is_active", true),
    ]);

  type Bucket = {
    liquid: number;
    fixed_income: number;
    variable_income: number;
    physical: number;
    credit_card_debt: number;
  };
  const byHousehold = new Map<string, Bucket>();
  const ensure = (id: string): Bucket => {
    let b = byHousehold.get(id);
    if (!b) {
      b = {
        liquid: 0,
        fixed_income: 0,
        variable_income: 0,
        physical: 0,
        credit_card_debt: 0,
      };
      byHousehold.set(id, b);
    }
    return b;
  };

  for (const a of (accounts ?? []) as AccountRow[]) {
    const b = ensure(a.household_id);
    const v = Number(a.current_balance ?? 0);
    if (a.type === "checking" || a.type === "savings" || a.type === "cash") {
      b.liquid += v;
    } else if (a.type === "credit_card") {
      // saldo negativo representa dívida — gravamos magnitude positiva
      b.credit_card_debt += Math.abs(Math.min(0, v));
    }
    // type=investment não soma (caixa de corretora pra evitar double count)
  }

  for (const i of (investments ?? []) as InvestmentRow[]) {
    const b = ensure(i.household_id);
    const v = Number(i.current_balance ?? 0);
    if (
      i.asset_type === "fixed_income_public" ||
      i.asset_type === "fixed_income_private"
    ) {
      b.fixed_income += v;
    } else {
      b.variable_income += v;
    }
  }

  for (const p of (physicals ?? []) as PhysicalRow[]) {
    const b = ensure(p.household_id);
    b.physical += Number(p.current_value ?? 0);
  }

  // Upsert
  const rows = [...byHousehold.entries()].map(([household_id, b]) => ({
    household_id,
    month_end: monthEnd,
    liquid: Math.round(b.liquid * 100) / 100,
    fixed_income: Math.round(b.fixed_income * 100) / 100,
    variable_income: Math.round(b.variable_income * 100) / 100,
    physical: Math.round(b.physical * 100) / 100,
    credit_card_debt: Math.round(b.credit_card_debt * 100) / 100,
    total:
      Math.round(
        (b.liquid + b.fixed_income + b.variable_income + b.physical - b.credit_card_debt) *
          100,
      ) / 100,
    currency: "BRL" as Currency,
  }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, month_end: monthEnd, snapshots: 0 });
  }

  const { error } = await supabase
    .from("patrimonio_snapshots")
    .upsert(rows, { onConflict: "household_id,month_end" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, month_end: monthEnd, snapshots: rows.length });
}
