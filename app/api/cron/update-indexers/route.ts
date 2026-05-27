import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cron diário: consulta API do Banco Central e atualiza indexer_history.
 *
 * Schedule recomendado (Vercel Cron, vercel.json):
 *   { "path": "/api/cron/update-indexers", "schedule": "0 10 * * *" }  // 07h BRT
 *
 * Autenticação: requer header `Authorization: Bearer <CRON_SECRET>` ou
 * o header `x-vercel-cron` (Vercel auto-injetado em cron jobs).
 *
 * Séries do BCB SGS — formato consumível pelo live-yield:
 *   selic e cdi: % ao ano
 *   ipca: % ao mês (anualizado no cálculo)
 *
 *   432  → Meta Selic Copom (% a.a.)
 *   4389 → CDI anualizado base 252 (% a.a.)
 *   433  → IPCA variação mensal (%)
 */
export const dynamic = "force-dynamic";

const SERIES: Record<"selic" | "cdi" | "ipca", number> = {
  selic: 432,
  cdi: 4389,
  ipca: 433,
};

async function fetchLatest(serie: number): Promise<{ date: string; value: number } | null> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const json = (await res.json()) as Array<{ data: string; valor: string }>;
  if (!json[0]) return null;
  const [dd, mm, yyyy] = json[0].data.split("/");
  return {
    date: `${yyyy}-${mm}-${dd}`,
    value: parseFloat(json[0].valor.replace(",", ".")),
  };
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

  const results: Record<string, { date: string; value: number } | null> = {};
  for (const [code, serie] of Object.entries(SERIES) as Array<[
    "selic" | "cdi" | "ipca",
    number,
  ]>) {
    const latest = await fetchLatest(serie);
    results[code] = latest;
    if (latest) {
      // Inclui fetched_at no payload pra UPSERT tocar a coluna mesmo quando
      // o valor não mudou (Selic só muda no Copom). Health check usa essa coluna.
      // Cast: coluna fetched_at adicionada via migration 20260527030000, types ainda não regenerados
      const { error } = await (supabase.from("indexer_history") as unknown as {
        upsert: (data: object, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
      })
        .upsert(
          {
            indexer: code,
            date: latest.date,
            value: latest.value,
            source: "bcb",
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "indexer,date" },
        );
      if (error) {
        return NextResponse.json({ ok: false, code, error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, updated: results });
}
