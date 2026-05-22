import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCsv } from "@/lib/utils/csv";
import type { TransactionKind } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * GET /api/transactions/export?month=YYYY-MM&kind=expense&q=texto
 *
 * Retorna text/csv com as transações do household logado, filtradas. Usa
 * o mesmo RLS dos endpoints (anon key + sessão), então só o dono vê.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthStr = searchParams.get("month") ?? undefined;
  const kind = (searchParams.get("kind") ?? "all") as TransactionKind | "all";
  const q = searchParams.get("q") ?? "";

  // monthRange duplicado pra não importar do services/transactions (que é "server-only")
  const now = new Date();
  let y: number, m: number;
  if (monthStr) {
    [y, m] = monthStr.split("-").map((x) => parseInt(x, 10));
  } else {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }).format(now);
    [y, m] = fmt.split("-").map((x) => parseInt(x, 10));
  }
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  let query = supabase
    .from("transactions")
    .select(
      "date, description, amount, currency, kind, payment_method, is_recurring, account:accounts(name), category:categories(name)",
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (kind !== "all") query = query.eq("kind", kind);
  if (q) query = query.ilike("description", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    date: string;
    description: string;
    amount: number;
    currency: string;
    kind: string;
    payment_method: string | null;
    is_recurring: boolean;
    account: { name: string } | { name: string }[] | null;
    category: { name: string } | { name: string }[] | null;
  };

  const rows = ((data ?? []) as Row[]).map((t) => {
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const cat = Array.isArray(t.category) ? t.category[0] : t.category;
    return {
      data: t.date,
      descricao: t.description,
      valor: Number(t.amount).toFixed(2).replace(".", ","),
      moeda: t.currency,
      tipo: t.kind,
      conta: acc?.name ?? "",
      categoria: cat?.name ?? "",
      forma_pagamento: t.payment_method ?? "",
      recorrente: t.is_recurring ? "sim" : "",
    };
  });

  const headers = [
    "data",
    "descricao",
    "valor",
    "moeda",
    "tipo",
    "conta",
    "categoria",
    "forma_pagamento",
    "recorrente",
  ];
  const csv = buildCsv(headers, rows);

  const filename = `transacoes-${y}-${String(m).padStart(2, "0")}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
