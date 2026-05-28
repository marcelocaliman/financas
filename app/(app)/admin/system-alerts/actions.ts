"use server";

import { revalidatePath } from "next/cache";
import { acknowledgeAlertAdmin } from "@/services/system-alerts";

export async function acknowledgeAlertAdminAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const r = await acknowledgeAlertAdmin(id);
  if (r.error) return { error: r.error };
  revalidatePath("/admin/system-alerts");
  return { ok: true };
}
