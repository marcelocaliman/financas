"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import type { Currency } from "@/types/database";

const profileSchema = z.object({
  displayName: z.string().min(1, "Como podemos te chamar?"),
});

const householdSchema = z.object({
  name: z.string().min(1, "O lar precisa de um nome."),
});

const displayCurrencySchema = z.object({
  currency: z.enum(["BRL", "EUR", "USD", "GBP"]),
});

const comparisonCurrencySchema = z.object({
  // "off" desliga; senão precisa ser uma moeda suportada
  currency: z.enum(["BRL", "EUR", "USD", "off"]),
});

export type ProfileFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const p = i.path.join(".");
    if (p && !out[p]) out[p] = i.message;
  }
  return out;
}

export async function updateProfile(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ display_name: parsed.data.displayName.trim() })
    .eq("id", ctx.profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateHousehold(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = householdSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({ name: parsed.data.name.trim() })
    .eq("id", ctx.household.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDisplayCurrency(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = displayCurrencySchema.safeParse({ currency: formData.get("currency") });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const current = (ctx.profile.preferences ?? {}) as Record<string, unknown>;
  const next = { ...current, displayCurrency: parsed.data.currency as Currency };

  const { error } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", ctx.profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateComparisonCurrency(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = comparisonCurrencySchema.safeParse({ currency: formData.get("currency") });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const current = (ctx.profile.preferences ?? {}) as Record<string, unknown>;
  // "off" persistimos como string "off" pra distinguir de "default" (ausente)
  const next = { ...current, comparisonCurrency: parsed.data.currency };

  const { error } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", ctx.profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
