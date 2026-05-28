import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Helper pra registrar falhas de background (cron, server actions
 * pós-mutação, sync IR) que o usuário NÃO veria normalmente. Substitui
 * `console.error` em paths críticos.
 *
 * Sempre best-effort: nunca propaga erro (registrar uma falha não pode
 * cascatear pra falhar o caller).
 *
 * Duas audiências:
 *   - Admin (você): vê tudo via /admin/system-alerts, com kind, message
 *     técnica e context JSON cru.
 *   - User comum: vê só os alerts com `user_facing=true`, na forma de
 *     `userMessage` (frase amigável). Sino no header dispara essas.
 */

export type SystemAlertSeverity = "info" | "warning" | "error";

export type SystemAlertInput = {
  /** Identificador curto da categoria (ex: "ir_sync_failed") */
  kind: string;
  /** Mensagem técnica pro admin (debug-friendly) */
  message: string;
  /** Severidade — controla cor/destaque na UI. Default: warning */
  severity?: SystemAlertSeverity;
  /** Household afetado, se aplicável */
  householdId?: string;
  /** Contexto extra (será serializado como JSONB) */
  context?: Record<string, unknown>;
  /** Se true, vira notificação no sino do header pro user. Default: false */
  userFacing?: boolean;
  /** Mensagem amigável pro user (obrigatória se userFacing=true) */
  userMessage?: string;
};

export async function recordSystemAlert(input: SystemAlertInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await (admin.from as unknown as (t: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    })("system_alerts").insert({
      kind: input.kind,
      message: input.message,
      severity: input.severity ?? "warning",
      household_id: input.householdId ?? null,
      context: input.context ?? null,
      user_facing: input.userFacing ?? false,
      user_message: input.userMessage ?? null,
    });
  } catch (e) {
    console.error("[system-alerts] falhou ao registrar:", e, input);
  }
}

// ============================================================================
// READS — Admin (vê tudo)
// ============================================================================

export type SystemAlertRow = {
  id: string;
  household_id: string | null;
  kind: string;
  message: string;
  severity: SystemAlertSeverity;
  context: Record<string, unknown> | null;
  user_facing: boolean;
  user_message: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

/**
 * Lista alertas pra dashboard admin. Sem filtro de household — admin vê
 * tudo. Aceita filtros opcionais.
 */
export async function listAllSystemAlerts(opts?: {
  kind?: string;
  severity?: SystemAlertSeverity;
  onlyUnacknowledged?: boolean;
  limit?: number;
}): Promise<SystemAlertRow[]> {
  const admin = createAdminClient();
  type Builder = {
    select: (s: string) => Builder;
    eq: (c: string, v: unknown) => Builder;
    is: (c: string, v: unknown) => Builder;
    order: (c: string, o: object) => Builder;
    limit: (n: number) => Promise<{ data: SystemAlertRow[] | null }>;
  };
  let query = (admin.from as unknown as (t: string) => Builder)("system_alerts")
    .select("*");
  if (opts?.kind) query = query.eq("kind", opts.kind);
  if (opts?.severity) query = query.eq("severity", opts.severity);
  if (opts?.onlyUnacknowledged) query = query.is("acknowledged_at", null);
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  return data ?? [];
}

// ============================================================================
// READS — User comum (sino do header, só user_facing dele)
// ============================================================================

/**
 * Lista alertas do household atual marcados `user_facing=true` e ainda
 * não acknowledged. Usado pelo sino no header. RLS filtra por household
 * automaticamente.
 */
export async function listUserAlerts(): Promise<SystemAlertRow[]> {
  const supabase = await createClient();
  type Builder = {
    select: (s: string) => Builder;
    eq: (c: string, v: unknown) => Builder;
    is: (c: string, v: unknown) => Builder;
    order: (c: string, o: object) => Builder;
    limit: (n: number) => Promise<{ data: SystemAlertRow[] | null }>;
  };
  const { data } = await (supabase.from as unknown as (t: string) => Builder)(
    "system_alerts",
  )
    .select("*")
    .eq("user_facing", true)
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

// ============================================================================
// WRITES — Acknowledge (admin ou user)
// ============================================================================

export async function acknowledgeAlert(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await (supabase.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  })("system_alerts")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function acknowledgeAlertAdmin(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await (admin.from as unknown as (t: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  })("system_alerts")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
