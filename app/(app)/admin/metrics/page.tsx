import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { getPlatformStats, listAllHouseholds, listAllUsers } from "@/services/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage() {
  const [stats, households, users] = await Promise.all([
    getPlatformStats(),
    listAllHouseholds(),
    listAllUsers(),
  ]);

  // Médias / agregados
  const avgMembersPerHousehold =
    households.length > 0 ? users.length / households.length : 0;
  const activeUsers = users.filter((u) => u.is_active).length;
  const usersWithLoginThisWeek = users.filter(
    (u) =>
      u.last_sign_in_at &&
      new Date(u.last_sign_in_at).getTime() >
        Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).length;
  const usersWithLoginThisMonth = users.filter(
    (u) =>
      u.last_sign_in_at &&
      new Date(u.last_sign_in_at).getTime() >
        Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Métricas · plataforma"
        title={
          <>
            Saúde do <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">produto</em>
          </>
        }
        subtitle="Visão agregada: crescimento, engajamento, retenção. Para análise mais profunda, conecte Posthog/Mixpanel no futuro."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Households totais"
          textValue={`${stats.total_households}`}
          tone="neutral"
          hint={`+${stats.new_households_7d} esta semana`}
        />
        <KpiCard
          label="Usuários ativos"
          textValue={`${activeUsers}`}
          tone="neutral"
          hint={`+${stats.new_users_7d} esta semana`}
        />
        <KpiCard
          label="Média membros/household"
          textValue={avgMembersPerHousehold.toFixed(1).replace(".", ",")}
          tone="neutral"
        />
        <KpiCard
          label="WAU (semana)"
          textValue={`${usersWithLoginThisWeek}`}
          tone="positive"
          hint={`${stats.total_users > 0 ? Math.round((usersWithLoginThisWeek / stats.total_users) * 100) : 0}% dos usuários`}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="MAU (mês)"
          textValue={`${usersWithLoginThisMonth}`}
          tone="positive"
        />
        <KpiCard
          label="Assinaturas ativas"
          textValue={`${stats.active_subscriptions}`}
          tone="positive"
        />
        <KpiCard
          label="Suspensos"
          textValue={`${stats.suspended}`}
          tone={stats.suspended > 0 ? "negative" : "muted"}
        />
      </div>

      <Panel className="mb-5">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
          Crescimento — últimos 7 dias
        </div>
        <ul className="space-y-2 text-[13px]">
          <li className="flex justify-between">
            <span className="text-muted-foreground">Novos households</span>
            <span className="font-mono tabular-nums text-foreground font-medium">
              +{stats.new_households_7d}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">Novos usuários</span>
            <span className="font-mono tabular-nums text-foreground font-medium">
              +{stats.new_users_7d}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">Em trial</span>
            <span className="font-mono tabular-nums text-foreground font-medium">
              {stats.trialing}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">Pedidos LGPD pendentes</span>
            <span
              className={
                "font-mono tabular-nums font-medium " +
                (stats.pending_data_requests > 0 ? "text-rust-600" : "text-foreground")
              }
            >
              {stats.pending_data_requests}
            </span>
          </li>
        </ul>
      </Panel>

      <Panel className="border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Próximas métricas (quando virar SaaS)
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground">
          <li>MRR (Monthly Recurring Revenue) — calculável quando integrar Stripe</li>
          <li>Churn rate mensal — % de cancelados/mês</li>
          <li>LTV (Lifetime Value) — média de receita por cliente</li>
          <li>CAC (Customer Acquisition Cost) — se rodar ads</li>
          <li>Conversão trial → pago</li>
          <li>NPS / feedback — adicionar coleta</li>
        </ul>
      </Panel>
    </>
  );
}
