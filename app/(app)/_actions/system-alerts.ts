"use server";

import { revalidatePath } from "next/cache";
import { acknowledgeAlert } from "@/services/system-alerts";

/**
 * User comum acknowledge um alert do próprio household (RLS controla).
 * Diferente de acknowledgeAlertAdminAction que opera via service_role.
 */
export async function acknowledgeUserAlertAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const r = await acknowledgeAlert(id);
  if (r.error) return { error: r.error };
  revalidatePath("/", "layout");
  return { ok: true };
}
