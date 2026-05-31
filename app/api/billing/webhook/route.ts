import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { tierForPriceId } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";

/**
 * Webhook do Stripe — a FONTE DA VERDADE do estado da assinatura. Só este
 * handler grava subscription_tier/status nos households. Verifica assinatura,
 * é idempotente (stripe_webhook_events) e tolerante a eventos fora de ordem.
 */
export const dynamic = "force-dynamic";

function tsToIso(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

export async function POST(req: Request) {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "billing não configurado" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "sem assinatura" }, { status: 400 });

  // RAW body é obrigatório pra verificação (não fazer req.json()).
  const raw = await req.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    logger.warn("webhook stripe: assinatura inválida", { msg: String(e) });
    return NextResponse.json({ error: "assinatura inválida" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotência: reivindica o event.id. Se já existe, ignora (200).
  const { data: claimed } = await admin
    .from("stripe_webhook_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event, admin);
  } catch (e) {
    logger.error("webhook stripe: erro ao processar", e, { type: event.type, id: event.id });
    // 500 faz o Stripe re-tentar; como já registramos o id, removemos pra
    // permitir reprocessamento na re-entrega.
    await admin.from("stripe_webhook_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "erro ao processar" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createAdminClient>;

async function householdIdFor(
  admin: Admin,
  metadataHouseholdId: string | undefined,
  customerId: string | null,
): Promise<string | null> {
  if (metadataHouseholdId) return metadataHouseholdId;
  if (!customerId) return null;
  const { data } = await admin
    .from("households")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function handleEvent(event: Stripe.Event, admin: Admin) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const hhId = await householdIdFor(
        admin,
        sub.metadata?.household_id,
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      );
      if (!hhId) {
        logger.warn("webhook: subscription sem household", { sub: sub.id });
        return;
      }

      const priceId = sub.items?.data?.[0]?.price?.id ?? null;
      const isDeleted = event.type === "customer.subscription.deleted";
      const tier = isDeleted ? "free" : tierForPriceId(priceId, process.env);

      // Mapeia o status do Stripe pro nosso enum.
      const statusMap: Record<string, string> = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        unpaid: "suspended",
        canceled: "cancelled",
        incomplete: "past_due",
        incomplete_expired: "cancelled",
        paused: "suspended",
      };
      const status = isDeleted ? "cancelled" : (statusMap[sub.status] ?? "active");

      const periodEnd = tsToIso((sub as unknown as { current_period_end?: number }).current_period_end);

      await admin
        .from("households")
        .update({
          subscription_tier: tier as "free" | "pro" | "family" | "lifetime",
          subscription_status: status as "active" | "trialing" | "past_due" | "cancelled" | "suspended",
          stripe_subscription_id: isDeleted ? null : sub.id,
          subscription_renews_at: periodEnd,
          trial_ends_at: tsToIso(sub.trial_end),
          subscription_cancel_at: tsToIso(sub.cancel_at),
          // Sair de past_due limpa o marcador; entrar registra.
          past_due_since: status === "past_due" ? new Date().toISOString() : null,
        })
        .eq("id", hhId)
        // Não sobrescreve override manual (lifetime/comp).
        .eq("subscription_manual_override", false);
      break;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const hhId = await householdIdFor(
        admin,
        undefined,
        typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null,
      );
      if (!hhId) return;
      await admin
        .from("households")
        .update({ subscription_status: "past_due", past_due_since: new Date().toISOString() })
        .eq("id", hhId)
        .eq("subscription_manual_override", false);
      break;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const hhId = await householdIdFor(
        admin,
        undefined,
        typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null,
      );
      if (!hhId) return;
      await admin
        .from("households")
        .update({ subscription_status: "active", past_due_since: null })
        .eq("id", hhId)
        .eq("subscription_manual_override", false);
      break;
    }

    default:
      // Outros eventos: registrados (idempotência) mas sem ação.
      break;
  }
}
