import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { listAllHouseholds } from "@/services/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const households = await listAllHouseholds();

  const byTier = {
    free: households.filter((h) => h.subscription_tier === "free").length,
    pro: households.filter((h) => h.subscription_tier === "pro").length,
    family: households.filter((h) => h.subscription_tier === "family").length,
    lifetime: households.filter((h) => h.subscription_tier === "lifetime").length,
  };
  const byStatus = {
    active: households.filter((h) => h.subscription_status === "active").length,
    trialing: households.filter((h) => h.subscription_status === "trialing").length,
    past_due: households.filter((h) => h.subscription_status === "past_due").length,
    cancelled: households.filter((h) => h.subscription_status === "cancelled").length,
    suspended: households.filter((h) => h.subscription_status === "suspended").length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Billing · planos"
        title={
          <>
            Assinaturas e <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">planos</em>
          </>
        }
        subtitle="Gestão de assinaturas. Hoje tudo é free (validação). Os campos Stripe estão prontos pra ativar quando integrar billing."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Free" textValue={`${byTier.free}`} tone="neutral" />
        <KpiCard label="Pro" textValue={`${byTier.pro}`} tone="neutral" />
        <KpiCard label="Family" textValue={`${byTier.family}`} tone="neutral" />
        <KpiCard label="Lifetime" textValue={`${byTier.lifetime}`} tone="positive" />
      </div>

      <Panel className="mb-6">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
          Distribuição por status
        </div>
        <div className="grid grid-cols-5 gap-3 text-[12.5px]">
          <StatusCell label="Ativos" count={byStatus.active} tone="olive" />
          <StatusCell label="Trial" count={byStatus.trialing} tone="navy" />
          <StatusCell label="Vencidos" count={byStatus.past_due} tone="gold" />
          <StatusCell label="Cancelados" count={byStatus.cancelled} tone="neutral" />
          <StatusCell label="Suspensos" count={byStatus.suspended} tone="rust" />
        </div>
      </Panel>

      <Panel className="!px-0">
        <div className="px-4 sm:px-7 pt-1 mb-3">
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
            Todos os households
          </div>
          <p className="text-[12.5px] text-faint-foreground mt-0.5">
            Clique em qualquer um pra alterar plano/status ou integrar Stripe
          </p>
        </div>
        <div className="overflow-x-auto px-4 sm:px-7">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Household</Th>
                <Th>Plano</Th>
                <Th>Status</Th>
                <Th>Renovação</Th>
                <Th>Stripe</Th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {households.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors"
                >
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/households/${h.id}`}
                      className="text-foreground font-medium text-[13.5px] hover:text-navy-700 dark:hover:text-navy-300"
                    >
                      {h.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={h.subscription_tier === "lifetime" ? "olive" : "neutral"}>
                      {h.subscription_tier}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge
                      tone={
                        h.subscription_status === "active"
                          ? "olive"
                          : h.subscription_status === "suspended"
                            ? "rust"
                            : h.subscription_status === "trialing"
                              ? "navy"
                              : "neutral"
                      }
                    >
                      {h.subscription_status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3 font-mono text-[11.5px] text-muted-foreground">
                    {h.subscription_renews_at
                      ? new Date(h.subscription_renews_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="py-3 pr-3 font-mono text-[10.5px] text-faint-foreground truncate max-w-[200px]">
                    {h.stripe_customer_id ?? "—"}
                  </td>
                  <td className="text-right pl-2">
                    <Link
                      href={`/admin/households/${h.id}`}
                      className="text-navy-700 dark:text-navy-300 text-[12.5px] hover:underline"
                    >
                      Editar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-6 border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Próximos passos pra cobrar
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground">
          <li>1. Criar produtos no Stripe (Pro mensal, Family mensal, Lifetime único)</li>
          <li>2. Criar checkout session em <code>/api/billing/checkout</code></li>
          <li>3. Webhook Stripe → atualizar <code>subscription_*</code> em <code>households</code></li>
          <li>4. Adicionar gating em features Pro/Family (helper hasFeature)</li>
          <li>5. Página <code>/configuracoes/billing</code> pro usuário gerenciar a própria assinatura (cancelar, alterar)</li>
        </ul>
      </Panel>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground pb-3 font-medium text-left pr-3">
      {children}
    </th>
  );
}

function StatusCell({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "olive" | "navy" | "gold" | "neutral" | "rust";
}) {
  return (
    <div className="rounded-[8px] border border-border bg-surface-muted/50 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground">
        {label}
      </div>
      <div className="mt-1 inline-flex items-center gap-2">
        <Badge tone={tone}>{count}</Badge>
      </div>
    </div>
  );
}
