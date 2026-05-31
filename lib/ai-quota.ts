import "server-only";
import { getEntitlements, EntitlementError } from "@/services/entitlements";
import { getCurrentUserContext } from "@/services/auth";
import { rateLimit, aiKey } from "@/lib/rate-limit";

/**
 * Cota de IA por household — fecha o buraco de custo das rotas OpenAI (ROADMAP
 * Security/Cost). Duas barreiras:
 *  1. Feature gate: o plano libera IA? (free não libera; billing off = libera).
 *  2. Limite diário por household (anti-abuso), derivado do orçamento do plano.
 *
 * Lança EntitlementError (capturado pelas actions pra mostrar upsell/aviso).
 */

export async function enforceAiQuota(action: string): Promise<void> {
  const ent = await getEntitlements();
  if (!ent.features.ai) {
    throw new EntitlementError("feature", "A leitura por IA está disponível em um plano superior.");
  }

  const budget = ent.limits.aiMonthlyBudgetCents;
  if (!Number.isFinite(budget)) return; // ilimitado (billing desligado / owner)

  // Limite diário derivado do orçamento mensal (proxy de custo). Pro(500)→50/dia.
  const dailyLimit = Math.max(20, Math.floor(budget / 10));

  const ctx = await getCurrentUserContext();
  if (!ctx) throw new EntitlementError("feature", "Sessão expirada.");

  const r = await rateLimit({
    key: aiKey(action, ctx.household.id),
    limit: dailyLimit,
    windowSeconds: 86_400,
  });
  if (!r.allowed) {
    throw new EntitlementError(
      "limit",
      "Você atingiu o limite diário de uso de IA. Tente de novo amanhã ou faça upgrade.",
    );
  }
}
