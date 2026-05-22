import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Conta itens "que pedem ação" pra cada seção da sidebar. Aparece como red
 * dot/badge ao lado do item — vira atalho visual: usuário não precisa abrir a
 * página pra saber se tem algo pendente.
 *
 * Hoje:
 *  - Recorrentes: nada (recorrências pausadas etc não pedem ação)
 *  - Resgates: saques pendentes (intents com status=pending e due_date <= hoje+7)
 *  - Transações: nada
 *  - Metas: metas que cruzaram 100% mas ainda não foram arquivadas (vitória!)
 *
 * Tudo é light: queries .head com count, sem trazer rows. Roda no layout server
 * e o resultado vai pro Sidebar via prop.
 */
export type SidebarBadges = {
  resgatesPendingSoon: number;
  metasJustAchieved: number;
};

function todayPlusISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getSidebarBadges(): Promise<SidebarBadges> {
  const supabase = await createClient();
  const soonCutoff = todayPlusISO(7);

  const [{ count: pendingCount }, { data: goals }] = await Promise.all([
    supabase
      .from("redemption_intents")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("due_date", soonCutoff),
    supabase
      .from("goals")
      .select("current_amount, target_amount")
      .eq("is_archived", false),
  ]);

  const metasJustAchieved = (goals ?? []).filter(
    (g) => Number(g.target_amount) > 0 && Number(g.current_amount) >= Number(g.target_amount),
  ).length;

  return {
    resgatesPendingSoon: pendingCount ?? 0,
    metasJustAchieved,
  };
}
