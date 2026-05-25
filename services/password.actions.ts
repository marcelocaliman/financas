"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "Nova senha precisa ter ao menos 8 caracteres."),
    confirm: z.string().min(8, "Confirme a nova senha."),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "As novas senhas não conferem.",
    path: ["confirm"],
  });

export type ChangePasswordState = {
  error?: string;
  ok?: boolean;
};

/**
 * Altera senha do usuário logado. Pede a senha atual pra reautenticar
 * (best practice contra session hijack).
 */
export async function changePassword(
  _prev: ChangePasswordState | undefined,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx?.email) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // Reautentica com a senha atual antes de aceitar a nova.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: ctx.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return { error: "Senha atual incorreta." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) return { error: error.message };

  return { ok: true };
}
