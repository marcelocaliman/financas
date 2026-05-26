import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

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
async function _ensureMaterialized(): Promise<{ created: number }> {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx) return { created: 0 };

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("materialize_all_recurrences", {
      p_household_id: ctx.household.id,
      p_until_date: today,
    });

    if (error) {
      console.error("[auto-materialize] erro silencioso:", error.message);
      return { created: 0 };
    }
    return { created: data ?? 0 };
  } catch (e) {
    console.error("[auto-materialize] exception:", e);
    return { created: 0 };
  }
}

export const ensureMaterialized = cache(_ensureMaterialized);
