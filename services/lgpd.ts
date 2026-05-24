import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Serviços LGPD (Lei 13.709/2018) — direitos do titular dos dados:
 *   - Acesso (art. 18 II): listConsents, exportUserData
 *   - Eliminação (art. 18 VI): requestDataDeletion, executeDataDeletion
 *   - Portabilidade (art. 18 V): exportUserData (JSON estruturado)
 *   - Consentimento (art. 8º): grantConsent, revokeConsent, listConsents
 *
 * Versão atual dos termos/política — incremente quando mudar conteúdo
 * pra forçar novo aceite.
 */
export const TERMS_VERSION = "1.0";
export const PRIVACY_VERSION = "1.0";

type ConsentType =
  | "terms_of_service"
  | "privacy_policy"
  | "data_processing"
  | "marketing_emails"
  | "analytics_cookies";

// ============================================================================
// Consentimentos
// ============================================================================

export async function grantConsent(
  type: ConsentType,
  version: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;

  const admin = createAdminClient();
  const { error } = await admin.from("user_consents").insert({
    user_id: user.id,
    consent_type: type,
    version,
    granted: true,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function revokeConsent(
  type: ConsentType,
  version: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;

  const admin = createAdminClient();
  const { error } = await admin.from("user_consents").insert({
    user_id: user.id,
    consent_type: type,
    version,
    granted: false,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Retorna o estado atual de cada tipo de consentimento (granted ou não)
 * pegando o registro mais recente por tipo.
 */
export type ConsentState = {
  type: ConsentType;
  version: string | null;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
};

export async function listConsents(): Promise<ConsentState[]> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_consents")
    .select("*")
    .eq("user_id", ctx.profile.id)
    .order("granted_at", { ascending: false });

  const allTypes: ConsentType[] = [
    "terms_of_service",
    "privacy_policy",
    "data_processing",
    "marketing_emails",
    "analytics_cookies",
  ];
  const latestByType = new Map<ConsentType, ConsentState>();
  for (const c of data ?? []) {
    const t = c.consent_type as ConsentType;
    if (latestByType.has(t)) continue; // já tem o mais recente
    latestByType.set(t, {
      type: t,
      version: c.version,
      granted: c.granted,
      grantedAt: c.granted ? c.granted_at : null,
      revokedAt: !c.granted ? c.granted_at : null,
    });
  }
  return allTypes.map(
    (t) =>
      latestByType.get(t) ?? {
        type: t,
        version: null,
        granted: false,
        grantedAt: null,
        revokedAt: null,
      },
  );
}

/**
 * Verifica se o usuário aceitou as versões atuais de termos + privacidade.
 * Usado pelo banner de consentimento.
 */
export async function hasAcceptedCurrentTerms(): Promise<boolean> {
  const consents = await listConsents();
  const terms = consents.find((c) => c.type === "terms_of_service");
  const privacy = consents.find((c) => c.type === "privacy_policy");
  return (
    !!terms?.granted &&
    !!privacy?.granted &&
    terms?.version === TERMS_VERSION &&
    privacy?.version === PRIVACY_VERSION
  );
}

// ============================================================================
// Data export (LGPD art. 18 V — portabilidade) — gera JSON com TODOS os dados
// ============================================================================

export async function exportUserData(): Promise<Record<string, unknown> | null> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;
  const admin = createAdminClient();
  const userId = ctx.profile.id;
  const householdId = ctx.household.id;

  // Auth
  const { data: authData } = await admin.auth.admin.getUserById(userId);

  // Tudo que pertence ao household OU foi criado pelo user
  const [
    profile,
    household,
    accounts,
    transactions,
    categories,
    investments,
    investmentMovements,
    goals,
    goalSources,
    goalContributions,
    recurringRules,
    redemptionIntents,
    consents,
    dataRequests,
  ] = await Promise.all([
    admin.from("users").select("*").eq("id", userId).maybeSingle(),
    admin.from("households").select("*").eq("id", householdId).maybeSingle(),
    admin.from("accounts").select("*").eq("household_id", householdId),
    admin.from("transactions").select("*").eq("household_id", householdId),
    admin.from("categories").select("*").eq("household_id", householdId),
    admin.from("investments").select("*").eq("household_id", householdId),
    admin
      .from("investment_movements")
      .select("*, investment:investments!inner(household_id)")
      .eq("investment.household_id", householdId),
    admin.from("goals").select("*").eq("household_id", householdId),
    admin
      .from("goal_sources")
      .select("*, goal:goals!inner(household_id)")
      .eq("goal.household_id", householdId),
    admin
      .from("goal_contributions")
      .select("*, goal:goals!inner(household_id)")
      .eq("goal.household_id", householdId),
    admin.from("recurring_rules").select("*").eq("household_id", householdId),
    admin
      .from("redemption_intents")
      .select("*, rule:yield_rules!inner(household_id)")
      .eq("rule.household_id", householdId),
    admin.from("user_consents").select("*").eq("user_id", userId),
    admin.from("data_access_requests").select("*").eq("user_id", userId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    lgpd_notice:
      "Dados pessoais e do household exportados conforme Lei 13.709/2018 art. 18 V. " +
      "Mantenha esse arquivo em local seguro — contém informações financeiras sensíveis.",
    user: {
      id: userId,
      email: authData.user?.email,
      created_at: authData.user?.created_at,
      last_sign_in_at: authData.user?.last_sign_in_at,
      profile: profile.data,
    },
    household: household.data,
    data: {
      accounts: accounts.data ?? [],
      transactions: transactions.data ?? [],
      categories: categories.data ?? [],
      investments: investments.data ?? [],
      investment_movements: investmentMovements.data ?? [],
      goals: goals.data ?? [],
      goal_sources: goalSources.data ?? [],
      goal_contributions: goalContributions.data ?? [],
      recurring_rules: recurringRules.data ?? [],
      redemption_intents: redemptionIntents.data ?? [],
    },
    privacy: {
      consents: consents.data ?? [],
      data_access_requests: dataRequests.data ?? [],
    },
  };
}

// ============================================================================
// Data requests (criar pedido de export/delete)
// ============================================================================

export async function requestDataAccess(
  type: "export" | "delete" | "rectify",
): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("data_access_requests")
    .insert({ user_id: ctx.profile.id, request_type: type })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { ok: true, id: data?.id };
}
