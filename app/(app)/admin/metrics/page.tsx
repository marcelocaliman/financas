import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { getPlatformStats } from "@/services/platform-admin";
import {
  getActionVolume,
  getDAUWAUMAU,
  getHouseholdGrowth,
  getStatusDistribution,
  getTierDistribution,
  getTopAdminActions,
  getUserGrowth,
} from "@/services/admin-metrics";
import { GrowthChart } from "@/components/admin/growth-chart";
import { DistributionChart } from "@/components/admin/distribution-chart";

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage() {
  const [
    stats,
    dauwaumau,
    growth7,
    growth30,
    growth90,
    users30,
    actions30,
    tiers,
    statuses,
    topAdmins,
  ] = await Promise.all([
    getPlatformStats(),
    getDAUWAUMAU(),
    getHouseholdGrowth(7),
    getHouseholdGrowth(30),
    getHouseholdGrowth(90),
    getUserGrowth(30),
    getActionVolume(30),
    getTierDistribution(),
    getStatusDistribution(),
    getTopAdminActions(30),
  ]);

  const new7 = growth7.reduce((s, p) => s + p.count, 0);
  const new30 = growth30.reduce((s, p) => s + p.count, 0);
  const new90 = growth90.reduce((s, p) => s + p.count, 0);

  return (
    <>
      <PageHeader
        eyebrow="Métricas · saúde do produto"
        title={
          <>
            Métricas <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">detalhadas</em>
          </>
        }
        subtitle="Crescimento, engajamento, distribuição de planos e ações admin. Charts em tempo real direto do banco."
      />

      {/* TIER 1: KPIs primários */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Households totais"
          textValue={`${stats.total_households}`}
          tone="neutral"
          hint={`+${new7} esta semana`}
        />
        <KpiCard
          label="Usuários totais"
          textValue={`${stats.total_users}`}
          tone="neutral"
          hint={`+${stats.new_users_7d} esta semana`}
        />
        <KpiCard
          label="MAU"
          textValue={`${dauwaumau.mau}`}
          tone="positive"
          hint={`stickiness ${(dauwaumau.stickiness * 100).toFixed(0)}%`}
        />
        <KpiCard
          label="Assinaturas ativas"
          textValue={`${stats.active_subscriptions}`}
          tone="positive"
          hint={`${stats.trialing} em trial`}
        />
      </div>

      {/* TIER 2: Crescimento — 3 janelas */}
      <Panel className="mb-5">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Crescimento de households · cumulativo
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4">
          Total cumulativo de households nos últimos 90 dias.
        </p>
        <div className="flex gap-2 mb-3 text-[11.5px] font-mono text-faint-foreground">
          <Badge tone="neutral">+{new7} em 7d</Badge>
          <Badge tone="neutral">+{new30} em 30d</Badge>
          <Badge tone="neutral">+{new90} em 90d</Badge>
        </div>
        <GrowthChart
          data={growth90}
          label="Households"
          color="var(--color-navy-700)"
          cumulative
        />
      </Panel>

      {/* TIER 3: Crescimento usuários + ações admin lado a lado */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Usuários novos (30 dias)
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            Cadastros diários no último mês
          </p>
          <GrowthChart
            data={users30}
            label="Novos usuários"
            color="var(--color-olive-600)"
          />
        </Panel>
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Ações admin (30 dias)
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            Volume diário de operações administrativas
          </p>
          <GrowthChart
            data={actions30}
            label="Ações"
            color="var(--color-gold-600)"
          />
        </Panel>
      </div>

      {/* TIER 4: Distribuição planos e status */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Distribuição por plano
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            Quantos households em cada tier
          </p>
          <DistributionChart
            data={tiers.map((t) => ({ label: t.tier, count: t.count }))}
          />
        </Panel>

        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Status das assinaturas
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            Active / Trial / Cancelled / Suspended
          </p>
          <DistributionChart
            data={statuses.map((s) => ({ label: s.status, count: s.count }))}
          />
        </Panel>
      </div>

      {/* TIER 5: Top admins */}
      {topAdmins.length > 0 ? (
        <Panel className="mb-5">
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Top admins (30 dias)
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-4">
            Quem fez mais ações administrativas no último mês
          </p>
          <ul className="space-y-2">
            {topAdmins.map((a, i) => (
              <li
                key={a.admin_email ?? i}
                className="flex items-center justify-between py-2 border-b border-border last:border-b-0 text-[13px]"
              >
                <span className="font-mono text-foreground truncate">
                  {a.admin_email ?? "—"}
                </span>
                <span className="font-mono tabular-nums text-faint-foreground">
                  {a.action_count} ações
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Próximas métricas (quando virar SaaS pago)
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground">
          <li>MRR (Monthly Recurring Revenue) — calculável quando integrar Stripe</li>
          <li>Churn rate mensal — % de cancelados/mês</li>
          <li>LTV (Lifetime Value) — média de receita por cliente</li>
          <li>CAC (Customer Acquisition Cost) — se rodar ads</li>
          <li>Conversão trial → pago</li>
          <li>Cohort retention (mês a mês)</li>
        </ul>
      </Panel>
    </>
  );
}
