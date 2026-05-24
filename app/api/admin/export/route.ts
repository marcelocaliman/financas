import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@/services/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Endpoint admin: exporta TODOS os dados de um usuário (escopo household).
 * Usado pra atender pedidos LGPD de export (art. 18 V).
 *
 * Guard: somente platform admin.
 * Resposta: JSON download.
 */
export async function GET(req: Request) {
  const ok = await isPlatformAdmin();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("household_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  const householdId = profile.household_id;

  const { data: authData } = await admin.auth.admin.getUserById(userId);

  const [
    user,
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

  const payload = {
    exported_at: new Date().toISOString(),
    exported_by_admin: true,
    lgpd_notice:
      "Dados exportados conforme Lei 13.709/2018 (LGPD) art. 18 V. " +
      "Mantenha o arquivo em local seguro — contém informações financeiras sensíveis.",
    user: {
      id: userId,
      email: authData.user?.email,
      created_at: authData.user?.created_at,
      last_sign_in_at: authData.user?.last_sign_in_at,
      profile: user.data,
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

  const filename = `financas-export-${authData.user?.email ?? userId}-${
    new Date().toISOString().slice(0, 10)
  }.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
