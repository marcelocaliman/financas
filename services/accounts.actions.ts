"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const ACCOUNT_TYPES = ["checking", "savings", "credit_card", "investment", "cash"] as const;

const createSchema = z.object({
  institution: z.string().min(1, "Qual instituição? (Itaú, Nubank, XP…)"),
  type: z.enum(ACCOUNT_TYPES),
  name: z.string().min(1, "Dê um apelido pra essa conta."),
  color: z.string().optional(),
  initialBalance: z.coerce.number().default(0),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

export type AccountFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}

export async function createAccount(
  _prev: AccountFormState | undefined,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = createSchema.safeParse({
    institution: formData.get("institution"),
    type: formData.get("type"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    initialBalance: formData.get("initialBalance") ?? 0,
  });
  if (!parsed.success) return { fieldErrors: parseFieldErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    household_id: ctx.household.id,
    institution: parsed.data.institution.trim(),
    type: parsed.data.type,
    name: parsed.data.name.trim(),
    color: parsed.data.color ?? null,
    current_balance: parsed.data.initialBalance,
  });
  if (error) return { error: error.message };

  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateAccount(
  _prev: AccountFormState | undefined,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    institution: formData.get("institution"),
    type: formData.get("type"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    initialBalance: formData.get("initialBalance") ?? 0,
  });
  if (!parsed.success) return { fieldErrors: parseFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      institution: parsed.data.institution.trim(),
      type: parsed.data.type,
      name: parsed.data.name.trim(),
      color: parsed.data.color ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveAccount(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function restoreAccount(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ is_active: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  return { ok: true };
}
