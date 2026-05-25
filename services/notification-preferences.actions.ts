"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

export type NotificationPrefs = {
  darf_due_soon: boolean;
  ir_retroactive_gaps: boolean;
  recurring_upcoming: boolean;
  monthly_recap: boolean;
};

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  const ctx = await getCurrentUserContext();
  const defaults: NotificationPrefs = {
    darf_due_soon: true,
    ir_retroactive_gaps: true,
    recurring_upcoming: false,
    monthly_recap: true,
  };
  if (!ctx) return defaults;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("darf_due_soon, ir_retroactive_gaps, recurring_upcoming, monthly_recap")
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  return (data as NotificationPrefs) ?? defaults;
}

export async function updateNotificationPreferences(
  prefs: NotificationPrefs,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        household_id: ctx.household.id,
        ...prefs,
      },
      { onConflict: "household_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/notificacoes");
  return { ok: true };
}
