import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Helper pra registrar falhas de background (cron, server actions
 * pós-mutação, sync IR) que o usuário NÃO veria normalmente. Substitui
 * `console.error` em paths críticos.
 *
 * Sempre best-effort: nunca propaga erro (registrar uma falha não pode
 * cascatear pra falhar o caller).
 */

export type SystemAlertInput = {
  /** Identificador curto da categoria (ex: "ir_sync_failed") */
  kind: string;
  /** Mensagem human-readable. */
  message: string;
  /** Household afetado, se aplicável. */
  householdId?: string;
  /** Contexto extra (será serializado como JSONB). */
  context?: Record<string, unknown>;
};

export async function recordSystemAlert(input: SystemAlertInput): Promise<void> {
  try {
    const admin = createAdminClient();
    // Cast forçado: types/database.ts ainda não foi regenerado pra incluir
    // system_alerts (criada via migration 20260528110000). Quando rodar
    // `pnpm db:types`, esse cast some.
    await (admin.from as unknown as (t: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    })("system_alerts").insert({
      kind: input.kind,
      message: input.message,
      household_id: input.householdId ?? null,
      context: input.context ?? null,
    });
  } catch (e) {
    // Último recurso: console.error não tem onde mais ir.
    console.error("[system-alerts] falhou ao registrar:", e, input);
  }
}
