import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Status básico dos jobs cron externos baseado em "última atualização" das
 * tabelas que cada cron alimenta. Útil pra diagnóstico em /configuracoes —
 * usuário consegue ver se algo parou de atualizar sem precisar abrir logs.
 *
 * Não há tabela de "cron_runs" dedicada — usamos as datas mais recentes nos
 * dados como proxy. É um indicador, não um SLO.
 */
export type CronCheck = {
  name: string;
  description: string;
  latestAt: string | null; // ISO datetime ou data
  /** Threshold em horas após o qual marcamos como "stale" */
  staleAfterHours: number;
};

function ageHours(iso: string | null): number | null {
  if (!iso) return null;
  // Aceita "YYYY-MM-DD" ou "YYYY-MM-DDTHH:MM:SS..."
  const t = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

export type CronStatus = CronCheck & {
  ageHours: number | null;
  status: "ok" | "stale" | "missing";
};

export async function getCronStatuses(): Promise<CronStatus[]> {
  const supabase = await createClient();

  const [{ data: idx }, { data: rate }, { data: quote }, { data: snap }] =
    await Promise.all([
      supabase
        .from("indexer_history")
        .select("date")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("currency_rates")
        .select("date")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("quote_snapshots")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("patrimonio_snapshots")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const checks: CronCheck[] = [
    {
      name: "Indexadores BCB",
      description: "Selic, CDI, IPCA · /api/cron/update-indexers",
      latestAt: idx?.date ?? null,
      staleAfterHours: 48, // dia útil
    },
    {
      name: "Taxas de câmbio",
      description: "USD/EUR/BRL · /api/cron/update-rates",
      latestAt: rate?.date ?? null,
      staleAfterHours: 48,
    },
    {
      name: "Cotações de ativos (brapi)",
      description: "FIIs, ações, ETFs · /api/quotes",
      latestAt: quote?.fetched_at ?? null,
      staleAfterHours: 24,
    },
    {
      name: "Snapshot mensal do patrimônio",
      description: "Histórico real pra sparkline · /api/cron/snapshot-patrimonio",
      latestAt: snap?.created_at ?? null,
      staleAfterHours: 24 * 35, // mensal: 35 dias é generoso
    },
  ];

  return checks.map((c) => {
    const h = ageHours(c.latestAt);
    let status: CronStatus["status"];
    if (c.latestAt == null || h == null) status = "missing";
    else if (h > c.staleAfterHours) status = "stale";
    else status = "ok";
    return { ...c, ageHours: h, status };
  });
}

export function formatAge(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1).replace(".", ",")} meses`;
}
