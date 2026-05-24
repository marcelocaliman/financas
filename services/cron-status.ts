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
  // Clamp negativo (timestamp futuro = "agora"). Defesa pra casos como
  // BCB Selic retornar a data do próximo Copom (futuro).
  return Math.max(0, (Date.now() - t) / (1000 * 60 * 60));
}

export type CronStatus = CronCheck & {
  ageHours: number | null;
  status: "ok" | "stale" | "missing";
};

export async function getCronStatuses(): Promise<CronStatus[]> {
  const supabase = await createClient();

  const [
    { data: idx },
    { data: rate },
    { data: quote },
    { data: snap },
    { data: lastApplied },
  ] = await Promise.all([
    supabase
      .from("indexer_history")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("currency_rates")
      .select("created_at")
      .order("created_at", { ascending: false })
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
    supabase
      .from("transactions")
      .select("balance_applied_at")
      .not("balance_applied_at", "is", null)
      .order("balance_applied_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const checks: CronCheck[] = [
    {
      name: "Indexadores BCB",
      description: "Selic, CDI, IPCA · /api/cron/update-indexers",
      latestAt: idx?.created_at ?? null,
      staleAfterHours: 72, // tolera fim de semana + 1 dia
    },
    {
      name: "Taxas de câmbio",
      description: "USD/EUR/BRL · /api/cron/update-rates",
      latestAt: rate?.created_at ?? null,
      staleAfterHours: 72, // tolera fim de semana + 1 dia
    },
    {
      name: "Cotações de ativos (brapi)",
      description:
        "FIIs, ações, ETFs · /api/cron/snapshot-quotes (10:30 + 18:30 BRT, dias úteis)",
      latestAt: quote?.fetched_at ?? null,
      // Snapshot mais recente deve ter no máx ~16h de idade (cron 18:30
      // sexta + 48h fim de semana = 64h ainda OK na segunda manhã). Marca
      // stale só acima de 72h pra não alarmar em segundas/feriados.
      staleAfterHours: 72,
    },
    {
      name: "Snapshot mensal do patrimônio",
      description: "Histórico real pra sparkline · /api/cron/snapshot-patrimonio",
      latestAt: snap?.created_at ?? null,
      staleAfterHours: 24 * 35, // mensal: 35 dias é generoso
    },
    {
      name: "Avanço de saldos pendentes",
      description:
        "Aplica deltas de tx pré-agendadas conforme a data chega · /api/cron/advance-balances",
      latestAt: lastApplied?.balance_applied_at ?? null,
      // Roda diário às 00:05 BRT. Se passar de 48h é sinal de cron quebrado.
      staleAfterHours: 48,
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
