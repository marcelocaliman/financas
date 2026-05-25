"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres."),
    confirm: z.string().min(8, "Confirme a senha."),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem.",
    path: ["confirm"],
  });

export type NovaSenhaState = {
  error?: string;
  ok?: boolean;
};

export async function updatePassword(
  _prev: NovaSenhaState | undefined,
  formData: FormData,
): Promise<NovaSenhaState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "Sessão expirou — peça um novo link de recuperação." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard?password_updated=1");
}
