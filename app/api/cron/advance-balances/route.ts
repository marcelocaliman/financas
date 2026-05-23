import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cron diário que "avança" o saldo das contas conforme transações pré-agendadas
 * cruzam o today boundary (em São Paulo).
 *
 * Chama RPC advance_pending_balances() — que faz UPDATE em
 * transactions com date ≤ today e balance_applied_at IS NULL.
 * O trigger BEFORE UPDATE detecta a transição (não-aplicado → aplicado)
 * e adiciona o delta ao current_balance da conta correspondente.
 *
 * Schedule (vercel.json):
 *   { "path": "/api/cron/advance-balances", "schedule": "5 3 * * *" }
 *   3:05 UTC = 00:05 BRT — logo depois da virada do dia em SP.
 *
 * Idempotente: rodar várias vezes no mesmo dia não tem efeito além da
 * primeira (a segunda execução não acha mais nenhuma row pendente
 * com date ≤ hoje).
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

  const { data, error } = await supabase.rpc("advance_pending_balances");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, advanced: data ?? 0 });
}
