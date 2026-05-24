"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin, recordAdminAction } from "@/services/platform-admin";
import { getCurrentUserContext } from "@/services/auth";

export type AnnouncementActionState = { ok?: boolean; error?: string };

const schema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  body: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  dismissible: z.coerce.boolean().default(true),
  linkUrl: z.string().url().optional().or(z.literal("")),
  linkLabel: z.string().optional(),
  targetTier: z
    .enum(["free", "pro", "family", "lifetime"])
    .optional()
    .or(z.literal("")),
});

export async function createAnnouncement(
  _prev: AnnouncementActionState | undefined,
  formData: FormData,
): Promise<AnnouncementActionState> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const parsed = schema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    severity: formData.get("severity") || "info",
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
    dismissible: formData.get("dismissible") === "on" || formData.get("dismissible") === "true",
    linkUrl: formData.get("linkUrl") || undefined,
    linkLabel: formData.get("linkLabel") || undefined,
    targetTier: formData.get("targetTier") || undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Inválido" };

  const ctx = await getCurrentUserContext();
  const admin = createAdminClient();
  const { error } = await admin.from("announcements").insert({
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    severity: parsed.data.severity,
    starts_at: parsed.data.startsAt || null,
    ends_at: parsed.data.endsAt || null,
    dismissible: parsed.data.dismissible,
    link_url: parsed.data.linkUrl || null,
    link_label: parsed.data.linkLabel || null,
    target_tier:
      (parsed.data.targetTier as "free" | "pro" | "family" | "lifetime") || null,
    created_by: ctx?.profile.id,
  });
  if (error) return { error: error.message };
  await recordAdminAction({
    action: "announcement.create",
    details: { title: parsed.data.title },
  });
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<AnnouncementActionState> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();
  const { error } = await admin.from("announcements").delete().eq("id", id);
  if (error) return { error: error.message };
  await recordAdminAction({ action: "announcement.delete", details: { id } });
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function dismissAnnouncement(announcementId: string): Promise<AnnouncementActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("announcement_dismissals")
    .insert({ user_id: user.id, announcement_id: announcementId });
  if (error && !error.message.includes("duplicate")) return { error: error.message };
  return { ok: true };
}
