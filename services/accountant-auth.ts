import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, tmplAccountantAccessNotification } from "@/services/email";
import type { Tables } from "@/types/database";

export type AccountantContext = {
  authId: string;
  email: string | null;
  profile: Tables<"accountant_profiles">;
};

export type AccessibleHousehold = {
  access: Tables<"accountant_household_access">;
  household: Tables<"households">;
  titularName: string | null;
};

/**
 * Carrega o perfil de contador (se o usuário logado for contador).
 * Cacheado por request.
 *
 * Retorna null se:
 *   - sem sessão
 *   - usuário logado tem perfil em public.users (= é titular, não contador)
 *   - usuário não tem perfil em accountant_profiles
 *
 * O caminho duplo é importante: um único auth.users pode (em tese) ter
 * apenas UM dos dois — ou é titular ou é contador. O middleware enforce isso.
 */
export const getCurrentAccountantContext = cache(
  async (): Promise<AccountantContext | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("accountant_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) return null;
    return {
      authId: user.id,
      email: user.email ?? null,
      profile,
    };
  },
);

/**
 * Lista todos os households que o contador atual tem acesso vigente.
 */
export async function listAccessibleHouseholds(): Promise<AccessibleHousehold[]> {
  const ctx = await getCurrentAccountantContext();
  if (!ctx) return [];

  const supabase = await createClient();
  const { data: accesses } = await supabase
    .from("accountant_household_access")
    .select("*")
    .eq("accountant_id", ctx.authId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("granted_at", { ascending: false });

  if (!accesses || accesses.length === 0) return [];

  const householdIds = accesses.map((a) => a.household_id);
  const { data: households } = await supabase
    .from("households")
    .select("*")
    .in("id", householdIds);

  const householdById = new Map(
    (households ?? []).map((h) => [h.id, h]),
  );

  // Nome do titular (primeiro user admin de cada household)
  const { data: titulars } = await supabase
    .from("users")
    .select("household_id, display_name, role")
    .in("household_id", householdIds);
  const titularByHousehold = new Map<string, string>();
  for (const u of titulars ?? []) {
    if (u.role === "admin" && !titularByHousehold.has(u.household_id)) {
      titularByHousehold.set(u.household_id, u.display_name);
    }
  }

  return accesses
    .map((a) => {
      const h = householdById.get(a.household_id);
      if (!h) return null;
      return {
        access: a,
        household: h,
        titularName: titularByHousehold.get(a.household_id) ?? null,
      };
    })
    .filter((x): x is AccessibleHousehold => x !== null);
}

/**
 * Verifica se o contador tem acesso ATIVO a um household específico
 * (e opcionalmente a um ano). Para uso nos route handlers /contador/[id]/...
 */
export async function assertAccountantAccess(
  householdId: string,
  year?: number,
): Promise<AccessibleHousehold | null> {
  const ctx = await getCurrentAccountantContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: access } = await supabase
    .from("accountant_household_access")
    .select("*")
    .eq("accountant_id", ctx.authId)
    .eq("household_id", householdId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!access) return null;
  if (year !== undefined && !(access.years_allowed ?? []).includes(year)) {
    return null;
  }

  const [{ data: household }, { data: titular }] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).maybeSingle(),
    supabase
      .from("users")
      .select("display_name")
      .eq("household_id", householdId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!household) return null;
  return {
    access,
    household,
    titularName: titular?.display_name ?? null,
  };
}

/**
 * Registra audit log + atualiza last_accessed_at.
 * Server-side only, fire-and-forget.
 */
export async function logAccountantAction(args: {
  householdId: string;
  action: string;
  targetYear?: number;
  details?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const ctx = await getCurrentAccountantContext();
  if (!ctx) return;

  const supabase = await createClient();
  await Promise.all([
    supabase.from("accountant_audit_log").insert({
      accountant_id: ctx.authId,
      household_id: args.householdId,
      action: args.action,
      target_year: args.targetYear ?? null,
      details: (args.details ?? {}) as never,
      ip_address: args.ip ?? null,
      user_agent: args.userAgent ?? null,
    }),
    supabase.rpc("touch_accountant_access", { p_household_id: args.householdId }),
  ]);

  // Notifica titular por email APENAS em ações sensíveis (downloads),
  // não em cada view. Evita spam mas mantém transparência LGPD.
  if (args.action === "export_dec" || args.action === "export_txt") {
    const admin = createAdminClient();
    const [{ data: titular }, { data: hh }] = await Promise.all([
      admin
        .from("users")
        .select("display_name")
        .eq("household_id", args.householdId)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle(),
      admin
        .from("households")
        .select("name, id")
        .eq("id", args.householdId)
        .maybeSingle(),
    ]);

    // Email do titular vem do auth.users — buscamos pelo id em users
    const { data: titularUser } = await admin
      .from("users")
      .select("id")
      .eq("household_id", args.householdId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (titularUser) {
      const { data: authUser } = await admin.auth.admin.getUserById(titularUser.id);
      const email = authUser?.user?.email;
      if (email && hh) {
        const tmpl = tmplAccountantAccessNotification({
          accountantName: ctx.profile.full_name,
          householdName: hh.name,
          action: args.action,
          year: args.targetYear,
          ip: args.ip ?? undefined,
        });
        // Fire and forget
        await sendEmail({
          to: email,
          subject: tmpl.subject,
          body: tmpl.body,
          notificationType: "accountant_access",
          relatedHouseholdId: args.householdId,
        });
      }
    }
    void titular;
  }
}
