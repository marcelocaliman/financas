"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { rateLimit, ipKey } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";

const baseSchema = z.object({
  displayName: z.string().min(1, "Como podemos te chamar?"),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres."),
});

const createSchema = baseSchema.extend({
  mode: z.literal("create"),
  householdName: z
    .string()
    .min(1, "Dê um nome ao lar — pode ser só o sobrenome.")
    .default("Nosso lar"),
});

const joinSchema = baseSchema.extend({
  mode: z.literal("join"),
  inviteCode: z
    .string()
    .min(4, "Código inválido.")
    .max(40, "Código inválido.") // códigos novos têm 32 chars (16 bytes hex)
    .transform((v) => v.trim().toUpperCase()),
});

const accountantSchema = baseSchema.extend({
  mode: z.literal("accountant"),
  redirectTo: z.string().optional(),
});

const schema = z.discriminatedUnion("mode", [createSchema, joinSchema, accountantSchema]);

export type SignupState = {
  error?: string;
  needsConfirmation?: boolean;
};

export async function signUp(
  _prev: SignupState | undefined,
  formData: FormData,
): Promise<SignupState> {
  // Anti-abuso: rate-limit por IP + captcha (ambos no-op se não configurados).
  if (env.AUTH_RATELIMIT_DISABLED !== true) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
    const rl = await rateLimit({ key: ipKey("signup", ip), limit: 10, windowSeconds: 3600 });
    if (!rl.allowed) {
      return { error: "Muitas tentativas de cadastro. Tente de novo em uma hora." };
    }
    const captchaOk = await verifyCaptcha(formData.get("captchaToken") as string | null, ip);
    if (!captchaOk) {
      return { error: "Verificação de segurança falhou. Recarregue e tente de novo." };
    }
  }

  const rawMode = formData.get("mode");
  const mode =
    rawMode === "join"
      ? "join"
      : rawMode === "accountant"
        ? "accountant"
        : "create";

  const parsed = schema.safeParse({
    mode,
    displayName: formData.get("displayName"),
    householdName: formData.get("householdName") || "Nosso lar",
    inviteCode: formData.get("inviteCode") ?? "",
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const userMetadata: Record<string, string> = {
    display_name: parsed.data.displayName,
    signup_mode: parsed.data.mode,
  };
  if (parsed.data.mode === "create") {
    userMetadata.household_name = parsed.data.householdName;
  } else if (parsed.data.mode === "join") {
    userMetadata.invite_code = parsed.data.inviteCode;
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: userMetadata,
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

  // Já com sessão — bootstrap ou redeem invite ou contador
  if (parsed.data.mode === "join") {
    const { error: redeemError } = await supabase.rpc("redeem_household_invite", {
      p_code: parsed.data.inviteCode,
      p_display_name: parsed.data.displayName,
    });
    if (redeemError) {
      const msg = redeemError.message.toLowerCase();
      if (msg.includes("not found")) return { error: "Código de convite não encontrado." };
      if (msg.includes("expired")) return { error: "Código expirado. Peça um novo ao admin do lar." };
      if (msg.includes("revoked")) return { error: "Esse código foi revogado." };
      if (msg.includes("already used")) return { error: "Esse código já foi usado." };
      return { error: redeemError.message };
    }
  } else if (parsed.data.mode === "accountant") {
    // Contador NÃO faz bootstrap_household. Vai pra /contador/onboarding
    // que cria accountant_profile.
    revalidatePath("/", "layout");
    redirect(parsed.data.redirectTo || "/contador/onboarding");
  } else {
    const { error: bootstrapError } = await supabase.rpc("bootstrap_household", {
      p_household_name: parsed.data.householdName,
      p_display_name: parsed.data.displayName,
    });
    if (bootstrapError) {
      return { error: "Conta criada, mas falhou ao montar seu lar. Tente entrar." };
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
