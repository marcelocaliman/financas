import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { recordSystemAlert } from "@/services/system-alerts";

/**
 * Materializa silenciosamente qualquer ocorrência pendente das regras
 * recorrentes ativas até a data de hoje (timezone SP).
 *
 * Idempotente: cada regra avança seu próprio `last_materialized_date`,
 * então chamadas repetidas são gratuitas. A função SQL é a mesma usada
 * pelo cron diário e pelo botão manual — apenas o trigger muda.
 *
 * Memoizada por request via React `cache()`, então múltiplas chamadas
 * dentro do mesmo render (ex: layout + page server components) viram 1.
 *
 * Falhas são silenciadas e logadas — não bloqueiam o carregamento da
 * página. Se algo der errado, o cron diário e a UI continuam funcionando.
 */
/** Janela mínima entre auto-materializes do mesmo household (em ms). */
const THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 horas

async function _ensureMaterialized(): Promise<{ created: number; skipped?: boolean }> {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx) return { created: 0 };

    const supabase = await createClient();

    // Throttle: se rodou recente, pula (cron diário cobre o resto).
    // Cast: coluna last_auto_materialize_at adicionada via migration
    // 20260526040000 mas tipos ainda não regenerados.
    const { data: hh } = await supabase
      .from("households")
      .select("last_auto_materialize_at" as never)
      .eq("id", ctx.household.id)
      .maybeSingle();
    const lastRunRaw = (hh as { last_auto_materialize_at?: string | null } | null)
      ?.last_auto_materialize_at;
    const lastRun = lastRunRaw ? new Date(lastRunRaw).getTime() : 0;
    if (Date.now() - lastRun < THROTTLE_MS) {
      return { created: 0, skipped: true };
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { data, error } = await supabase.rpc("materialize_all_recurrences", {
      p_household_id: ctx.household.id,
      p_until_date: today,
    });

    if (error) {
      await recordSystemAlert({
        kind: "auto_materialize_failed",
        message: "Falha na materialização automática de recorrências.",
        severity: "warning",
        householdId: ctx.household.id,
        context: { error: error.message, untilDate: today },
        userFacing: true,
        userMessage:
          "Algumas recorrências de hoje não foram criadas automaticamente. " +
          "Atualize a página em alguns minutos — se persistir, entre em contato.",
      });
      return { created: 0 };
    }

    // Atualiza last_auto_materialize_at independente de quantas criou.
    await supabase
      .from("households")
      .update({ last_auto_materialize_at: new Date().toISOString() } as never)
      .eq("id", ctx.household.id);

    return { created: data ?? 0 };
  } catch (e) {
    await recordSystemAlert({
      kind: "auto_materialize_exception",
      message: "Exceção inesperada na materialização automática.",
      severity: "error",
      context: { error: e instanceof Error ? e.message : String(e) },
      // sem userFacing — exception genérica, admin investiga
    });
    return { created: 0 };
  }
}

export const ensureMaterialized = cache(_ensureMaterialized);
