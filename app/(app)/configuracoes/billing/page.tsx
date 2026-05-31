import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { getCurrentUserContext } from "@/services/auth";
import { getEntitlements } from "@/services/entitlements";
import { isBillingEnabled } from "@/lib/stripe";
import { PLANS, PAID_TIERS } from "@/lib/billing/plans";
import { BillingPanel } from "@/components/billing/billing-panel";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const [ctx, ent] = await Promise.all([getCurrentUserContext(), getEntitlements()]);
  const billingEnabled = isBillingEnabled();
  const isAdmin = ctx?.profile.role === "admin";

  // Só os campos de display (evita serializar Infinity dos limites).
  const planCards = [PLANS.free, ...PAID_TIERS.map((t) => PLANS[t])].map((p) => ({
    tier: p.tier,
    name: p.name,
    priceMonthlyBRL: p.priceMonthlyBRL,
    blurb: p.blurb,
    highlights: p.highlights,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Configurações · assinatura"
        title={
          <>
            Seu{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              plano
            </em>
          </>
        }
        subtitle="Gerencie sua assinatura, troque de plano ou atualize a forma de pagamento."
      />
      {billingEnabled ? (
        <BillingPanel
          tier={ent.tier}
          status={ent.status}
          trialEndsAt={ent.trialEndsAt}
          isAdmin={isAdmin}
          plans={planCards}
        />
      ) : (
        <Panel>
          <div className="py-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint-foreground">
              Billing
            </div>
            <p className="mt-2 text-[14px] text-foreground">
              A cobrança ainda não foi ativada nesta instância.
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Todo o app está liberado. Quando o billing for ligado, esta página
              passa a oferecer os planos e a gestão da assinatura.
            </p>
          </div>
        </Panel>
      )}
    </>
  );
}
