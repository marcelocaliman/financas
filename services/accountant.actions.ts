"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/services/auth";
import { getCurrentAccountantContext } from "@/services/accountant-auth";
import { DPA_TERMS_HASH } from "@/services/accountant-dpa";
import { queueEmail, tmplAccountantInvite } from "@/services/email";

export type AccountantFormState = {
  ok?: boolean;
  error?: string;
  inviteUrl?: string;
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

// ============================================================================
// USER → CRIAR CONVITE
// ============================================================================
const inviteSchema = z.object({
  email: z.string().email("Email inválido."),
  years_allowed: z
    .array(z.coerce.number().int())
    .min(1, "Selecione ao menos um ano."),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

export async function createAccountantInvite(
  _prev: AccountantFormState | undefined,
  formData: FormData,
): Promise<AccountantFormState> {
  const years = formData.getAll("years_allowed").map((v) => Number(v));
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    years_allowed: years,
    expires_at: formData.get("expires_at"),
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  // Validação: expires_at no futuro
  const exp = new Date(parsed.data.expires_at);
  const maxExp = new Date();
  maxExp.setMonth(maxExp.getMonth() + 2); // máximo 60 dias
  if (exp <= new Date()) return { error: "Expiração precisa ser futura." };
  if (exp > maxExp) return { error: "Expiração máxima: 60 dias." };

  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const email = parsed.data.email.toLowerCase().trim();

  // Dedup: se já existe convite ativo (não aceito, não revogado, não expirado)
  // pro mesmo email + household, retorna o existente em vez de criar outro.
  const { data: existing } = await supabase
    .from("accountant_invites")
    .select("token, expires_at")
    .eq("household_id", ctx.household.id)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing) {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://financas.example.com";
    return {
      ok: true,
      inviteUrl: `${base}/contador/aceitar?token=${existing.token}`,
      error: "Já existe convite ativo pra esse contador. Reutilizando o link.",
    };
  }

  const { data, error } = await supabase
    .from("accountant_invites")
    .insert({
      household_id: ctx.household.id,
      invited_by: ctx.profile.id,
      email,
      token,
      scope: "ir_readonly",
      years_allowed: parsed.data.years_allowed,
      expires_at: exp.toISOString(),
    })
    .select("token")
    .single();

  if (error || !data) return { error: error?.message ?? "Falha ao criar convite." };

  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://financas.example.com";
  const inviteUrl = `${base}/contador/aceitar?token=${data.token}`;

  // Envia email automaticamente (best-effort, não bloqueia retorno)
  const tmpl = tmplAccountantInvite({
    inviterName: ctx.profile.display_name,
    householdName: ctx.household.name,
    inviteUrl,
    years: parsed.data.years_allowed,
    expiresAt: exp.toISOString(),
  });
  await queueEmail({
    to: email,
    subject: tmpl.subject,
    body: tmpl.body,
    notificationType: "accountant_invite",
    relatedHouseholdId: ctx.household.id,
  });

  revalidatePath("/ir");
  for (const y of parsed.data.years_allowed) {
    revalidatePath(`/ir/${y}/configuracoes`);
  }
  return { ok: true, inviteUrl };
}

// ============================================================================
// USER → REVOGAR CONVITE PENDENTE
// ============================================================================
export async function revokeAccountantInvite(id: string): Promise<AccountantFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accountant_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/ir");
  return { ok: true };
}

// ============================================================================
// USER → REVOGAR ACESSO ATIVO (contador já aceitou)
// ============================================================================
const revokeAccessSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional().nullable(),
});

export async function revokeAccountantAccess(
  args: z.infer<typeof revokeAccessSchema>,
): Promise<AccountantFormState> {
  const parsed = revokeAccessSchema.safeParse(args);
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("accountant_household_access")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: parsed.data.reason ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/ir");
  return { ok: true };
}

// ============================================================================
// CONTADOR → COMPLETAR PERFIL (primeiro acesso após auth signup)
// ============================================================================
const profileSchema = z.object({
  full_name: z.string().min(2, "Nome obrigatório."),
  crc_number: z.string().optional().nullable(),
  crc_state: z
    .string()
    .regex(/^[A-Z]{2}$/, "UF inválida (use formato MG, SP, RJ).")
    .optional()
    .nullable(),
  phone: z.string().optional().nullable(),
  accepted_dpa: z.string().refine((v) => v === "on" || v === "true", {
    message: "É necessário aceitar o termo.",
  }),
});

export async function completeAccountantProfile(
  _prev: AccountantFormState | undefined,
  formData: FormData,
): Promise<AccountantFormState> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    crc_number: formData.get("crc_number") || null,
    crc_state: formData.get("crc_state") || null,
    phone: formData.get("phone") || null,
    accepted_dpa: formData.get("accepted_dpa"),
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // Bloqueio: usuário não pode ser titular E contador no mesmo auth account
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existingUser) {
    return {
      error:
        "Esse email já tem uma conta de usuário titular. Crie outra conta apenas pra atuar como contador.",
    };
  }

  const { error } = await supabase.from("accountant_profiles").upsert({
    id: user.id,
    full_name: parsed.data.full_name.trim(),
    email: user.email ?? "",
    crc_number: parsed.data.crc_number?.trim() || null,
    crc_state: parsed.data.crc_state?.toUpperCase() || null,
    phone: parsed.data.phone?.trim() || null,
    accepted_dpa_at: new Date().toISOString(),
    dpa_terms_hash: DPA_TERMS_HASH,
    is_active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/contador");
  return { ok: true };
}

// ============================================================================
// CONTADOR → ACEITAR CONVITE (via token)
// ============================================================================
export async function acceptAccountantInvite(
  token: string,
): Promise<AccountantFormState> {
  if (!token || token.length < 32) return { error: "Token inválido." };

  const ctx = await getCurrentAccountantContext();
  if (!ctx) {
    return {
      error: "Crie seu perfil de contador antes de aceitar o convite.",
    };
  }

  const admin = createAdminClient();

  // Service role pra ler+atualizar o convite (contador não pertence ao
  // household que emitiu, RLS bloquearia)
  const { data: invite } = await admin
    .from("accountant_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (!invite) return { error: "Convite inválido, expirado ou já usado." };
  if (new Date(invite.expires_at) < new Date()) {
    return { error: "Convite expirado." };
  }
  if (invite.email.toLowerCase() !== (ctx.email ?? "").toLowerCase()) {
    return {
      error: `Esse convite foi enviado para ${invite.email}. Faça login com esse email.`,
    };
  }

  // Cria acesso ativo (upsert por (accountant, household)) via admin
  const { error: accessErr } = await admin
    .from("accountant_household_access")
    .upsert(
      {
        accountant_id: ctx.authId,
        household_id: invite.household_id,
        invite_id: invite.id,
        scope: invite.scope,
        years_allowed: invite.years_allowed,
        expires_at: invite.expires_at,
        granted_at: new Date().toISOString(),
        revoked_at: null,
        revoked_reason: null,
      },
      { onConflict: "accountant_id,household_id" },
    );
  if (accessErr) return { error: accessErr.message };

  // Marca convite como aceito
  await admin
    .from("accountant_invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: ctx.authId,
    })
    .eq("id", invite.id);

  revalidatePath("/contador");
  return { ok: true };
}
