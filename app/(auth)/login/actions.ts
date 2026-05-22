"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres."),
  redirectTo: z.string().optional(),
});

const magicSchema = z.object({
  email: z.string().email("E-mail inválido."),
});

export type LoginState = {
  error?: string;
  ok?: boolean;
};

export async function signInWithPassword(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "E-mail ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  redirect(parsed.data.redirectTo || "/dashboard");
}

export async function sendMagicLink(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = magicSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${appUrl}/callback`,
    },
  });

  if (error) {
    return { error: "Não foi possível enviar o link agora. Tente em alguns minutos." };
  }
  return { ok: true };
}
