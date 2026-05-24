"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin, recordAdminAction } from "@/services/platform-admin";
import { getCurrentUserContext } from "@/services/auth";

export type FlagActionState = { ok?: boolean; error?: string };

const flagSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Use snake_case com letras/números"),
  enabled: z.coerce.boolean(),
  description: z.string().optional(),
  rolloutPct: z.coerce.number().int().min(0).max(100).default(100),
  enabledForTiers: z.array(z.enum(["free", "pro", "family", "lifetime"])).default([]),
});

export async function toggleFlag(key: string, enabled: boolean): Promise<FlagActionState> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const ctx = await getCurrentUserContext();
  const admin = createAdminClient();
  const { error } = await admin
    .from("feature_flags")
    .update({
      enabled,
      updated_by: ctx?.profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key);
  if (error) return { error: error.message };
  await recordAdminAction({
    action: enabled ? "feature_flag.enable" : "feature_flag.disable",
    details: { key },
  });
  revalidatePath("/admin/feature-flags");
  return { ok: true };
}

export async function upsertFlag(formData: FormData): Promise<FlagActionState> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const parsed = flagSchema.safeParse({
    key: formData.get("key"),
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    description: formData.get("description") || undefined,
    rolloutPct: formData.get("rolloutPct") ?? 100,
    enabledForTiers: formData.getAll("enabledForTiers"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Inválido" };

  const ctx = await getCurrentUserContext();
  const admin = createAdminClient();
  const { error } = await admin.from("feature_flags").upsert({
    key: parsed.data.key,
    enabled: parsed.data.enabled,
    description: parsed.data.description ?? null,
    rollout_pct: parsed.data.rolloutPct,
    enabled_for_tiers: parsed.data.enabledForTiers,
    updated_by: ctx?.profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  await recordAdminAction({
    action: "feature_flag.upsert",
    details: parsed.data,
  });
  revalidatePath("/admin/feature-flags");
  return { ok: true };
}

export async function deleteFlag(key: string): Promise<FlagActionState> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();
  const { error } = await admin.from("feature_flags").delete().eq("key", key);
  if (error) return { error: error.message };
  await recordAdminAction({ action: "feature_flag.delete", details: { key } });
  revalidatePath("/admin/feature-flags");
  return { ok: true };
}

export async function updateFlagDetails(
  key: string,
  patch: {
    rolloutPct?: number;
    enabledForTiers?: ("free" | "pro" | "family" | "lifetime")[];
    description?: string;
  },
): Promise<FlagActionState> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const ctx = await getCurrentUserContext();
  const admin = createAdminClient();
  type FlagUpdate = {
    rollout_pct?: number;
    enabled_for_tiers?: string[];
    description?: string | null;
    updated_by?: string;
    updated_at: string;
  };
  const update: FlagUpdate = { updated_at: new Date().toISOString() };
  if (patch.rolloutPct != null) update.rollout_pct = patch.rolloutPct;
  if (patch.enabledForTiers) update.enabled_for_tiers = patch.enabledForTiers;
  if (patch.description !== undefined) update.description = patch.description;
  if (ctx) update.updated_by = ctx.profile.id;

  const { error } = await admin.from("feature_flags").update(update).eq("key", key);
  if (error) return { error: error.message };
  await recordAdminAction({
    action: "feature_flag.update",
    details: { key, patch },
  });
  revalidatePath("/admin/feature-flags");
  return { ok: true };
}
