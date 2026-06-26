import { supabase } from "@/lib/supabase";

export type CheckoutPlan = "monthly" | "annual";

export interface CreateSubResult {
  mode: "payment" | "setup" | "none";
  clientSecret?: string;
  subscriptionId?: string;
  alreadyActive?: boolean;
  status?: string;
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function call(action: string, body?: unknown): Promise<Record<string, unknown>> {
  const tok = await token();
  const res = await fetch(`/api/billing?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || `http_${res.status}`);
  return data;
}

export const billing = {
  createSubscription: (plan: CheckoutPlan) => call("create-subscription", { plan }) as unknown as Promise<CreateSubResult>,
  cancel: () => call("cancel"),
  resume: () => call("resume"),
};
