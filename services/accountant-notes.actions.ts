"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentAccountantContext,
  assertAccountantAccess,
} from "@/services/accountant-auth";
import { getCurrentUserContext } from "@/services/auth";

const SECTIONS = ["bens", "rendimentos", "renda_variavel", "imposto", "pagamentos", "geral"] as const;

const createSchema = z.object({
  householdId: z.string().uuid(),
  year: z.coerce.number().int(),
  section: z.enum(SECTIONS),
  content: z.string().min(3, "Anotação muito curta."),
});

export type NoteFormState = {
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

export async function createAccountantNote(
  args: z.infer<typeof createSchema>,
): Promise<NoteFormState> {
  const parsed = createSchema.safeParse(args);
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentAccountantContext();
  if (!ctx) return { error: "Sessão expirada." };

  // Valida acesso
  const access = await assertAccountantAccess(parsed.data.householdId, parsed.data.year);
  if (!access) return { error: "Sem acesso a esse ano." };

  const supabase = await createClient();
  const { error } = await supabase.from("accountant_notes").insert({
    accountant_id: ctx.authId,
    household_id: parsed.data.householdId,
    year: parsed.data.year,
    section: parsed.data.section,
    content: parsed.data.content.trim(),
    status: "open",
  });
  if (error) return { error: error.message };

  revalidatePath(`/contador/${parsed.data.householdId}/ir/${parsed.data.year}`);
  revalidatePath(`/ir/${parsed.data.year}`);
  return { ok: true };
}

export async function resolveAccountantNote(id: string): Promise<NoteFormState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("accountant_notes")
    .update({
      status: "resolved",
      resolved_by: ctx.profile.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ir");
  return { ok: true };
}

export async function deleteAccountantNote(id: string): Promise<NoteFormState> {
  const ctx = await getCurrentAccountantContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("accountant_notes")
    .delete()
    .eq("id", id)
    .eq("accountant_id", ctx.authId);
  if (error) return { error: error.message };
  revalidatePath("/contador");
  return { ok: true };
}
