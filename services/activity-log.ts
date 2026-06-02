import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ActivityAction = "insert" | "update" | "delete";

export type ActivityLogEntry = {
  id: string;
  table_name: string;
  row_id: string;
  action: ActivityAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  undone_at: string | null;
  created_at: string;
  actor: { display_name: string | null } | null;
};

/**
 * Histórico/auditoria de mudanças do household — alimentado pelo trigger
 * tg_activity_audit (migration 20260602120000). Cada item tem snapshot old/new
 * pra permitir desfazer. RLS limita ao household do usuário.
 *
 * Tabela nova (não está nos tipos gerados) → cast no client tipado.
 */
export async function getActivityLog(limit = 120): Promise<ActivityLogEntry[]> {
  const supabase = await createClient();
  const { data, error } = (await (
    supabase
      .from("activity_log" as never)
      .select(
        "id, table_name, row_id, action, old_data, new_data, undone_at, created_at, actor:users(display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit) as unknown as Promise<{ data: ActivityLogEntry[] | null; error: unknown }>
  ));
  if (error || !data) return [];
  return data;
}
