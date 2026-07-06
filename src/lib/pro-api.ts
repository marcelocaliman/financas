import { supabase } from "@/lib/supabase";

/** Estado da assinatura Pro (METADADO — nunca dado financeiro). Espelha api/admin.ts. */
export type ProStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export interface ProSubscription {
  status: ProStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan: string | null;
  trial_started: boolean;
}

export const proApi = {
  /** Fonte da verdade do gate (admin é sempre Pro). RPC SECURITY DEFINER. */
  isPro: async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc("is_pro");
    if (error) throw error;
    return !!data;
  },
  /** Concede o trial de 14 dias (1× por conta). Retorna a linha resultante. */
  startTrial: async (): Promise<ProSubscription | null> => {
    const { data, error } = await supabase.rpc("start_trial");
    if (error) throw error;
    return (data as ProSubscription) ?? null;
  },
  /** Lê a própria linha (RLS: só a do auth.uid()) p/ mostrar status/trial na UI. */
  getSubscription: async (): Promise<ProSubscription | null> => {
    const { data, error } = await supabase
      .from("pro_subscriptions")
      .select("status, trial_ends_at, current_period_end, cancel_at_period_end, plan, trial_started")
      .maybeSingle();
    if (error) throw error;
    return (data as ProSubscription) ?? null;
  },
};
