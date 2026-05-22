"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  displayName: z.string().min(1, "Como podemos te chamar?"),
  householdName: z
    .string()
    .min(1, "Dê um nome ao lar — pode ser só o sobrenome.")
    .default("Nosso lar"),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres."),
});

export type SignupState = {
  error?: string;
  needsConfirmation?: boolean;
};

export async function signUp(
  _prev: SignupState | undefined,
  formData: FormData,
): Promise<SignupState> {
  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
    householdName: formData.get("householdName") || "Nosso lar",
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        household_name: parsed.data.householdName,
      },
      emailRedirectTo: `${appUrl}/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("registered")) {
      return { error: "Esse e-mail já está cadastrado. Tente entrar." };
    }
    return { error: error.message };
  }

  // Quando confirmação por email está habilitada, a sessão é nula
  if (!data.session) {
    return { needsConfirmation: true };
  }

  // Já com sessão — bootstrap household + perfil + categorias padrão
  const { error: bootstrapError } = await supabase.rpc("bootstrap_household", {
    p_household_name: parsed.data.householdName,
    p_display_name: parsed.data.displayName,
  });

  if (bootstrapError) {
    return { error: "Conta criada, mas falhou ao montar seu lar. Tente entrar." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
