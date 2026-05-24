"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin, recordAdminAction } from "@/services/platform-admin";
import { getCurrentUserContext } from "@/services/auth";
import type { Json } from "@/types/database";

export type SettingActionState = { ok?: boolean; error?: string };

export async function updateSystemSetting(
  key: string,
  value: Json,
): Promise<SettingActionState> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const ctx = await getCurrentUserContext();
  const admin = createAdminClient();

  const { error } = await admin
    .from("system_settings")
    .upsert({
      key,
      value,
      updated_by: ctx?.profile.id,
      updated_at: new Date().toISOString(),
    });
  if (error) return { error: error.message };
  await recordAdminAction({
    action: "system_setting.update",
    details: { key, value },
  });
  revalidatePath("/admin/system");
  revalidatePath("/admin/settings");
  return { ok: true };
}
