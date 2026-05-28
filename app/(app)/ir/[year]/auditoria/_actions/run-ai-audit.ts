"use server";

import { runTaxAudit, type AuditAiResult } from "@/services/ai/tax-audit";
import { getCurrentUserContext } from "@/services/auth";
import { recordSystemAlert } from "@/services/system-alerts";

export type RunAiAuditState =
  | { ok: true; result: AuditAiResult; costCents: number }
  | { ok: false; error: string };

export async function runAiAudit(year: number): Promise<RunAiAuditState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { ok: false, error: "Sessão expirada." };
  if (!Number.isFinite(year) || year < 2000) return { ok: false, error: "Ano inválido." };

  const res = await runTaxAudit(year);
  if (!res.ok) {
    await recordSystemAlert({
      kind: "ai_tax_audit_failed",
      severity: "warning",
      message: res.error,
      householdId: ctx.household.id,
      context: { year, user_id: ctx.authId },
    });
    return { ok: false, error: res.error };
  }

  return { ok: true, result: res.result, costCents: res.usage.costCents };
}
