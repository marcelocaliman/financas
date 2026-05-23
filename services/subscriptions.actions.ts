"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Adiciona ou remove a tag 'subscription' da regra recorrente.
 * Usado pelo botão "Marcar como assinatura" / "Desmarcar".
 */
export async function toggleSubscriptionTag(
  ruleId: string,
  shouldBeSubscription: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: rule } = await supabase
    .from("recurring_rules")
    .select("tags")
    .eq("id", ruleId)
    .maybeSingle();
  if (!rule) return { error: "Regra não encontrada." };

  const currentTags = (rule.tags ?? []) as string[];
  let newTags: string[];
  if (shouldBeSubscription) {
    newTags = currentTags.includes("subscription")
      ? currentTags
      : [...currentTags, "subscription"];
  } else {
    newTags = currentTags.filter((t) => t !== "subscription");
  }

  const { error } = await supabase
    .from("recurring_rules")
    .update({ tags: newTags })
    .eq("id", ruleId);
  if (error) return { error: error.message };

  revalidatePath("/recorrentes");
  revalidatePath("/assinaturas");
  revalidatePath("/dashboard");
  return { ok: true };
}
