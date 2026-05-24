import Link from "next/link";
import { Home, Users, CreditCard, FileWarning, Activity, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { getPlatformStats, listAuditLog } from "@/services/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, recentAudit] = await Promise.all([
    getPlatformStats(),
    listAuditLog({ limit: 10 }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Plataforma · governança"
        title={
          <>
            Painel <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">superadmin</em>
          </>
        }
        subtitle="Visão geral de households, usuários, assinaturas e ações recentes."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        <KpiCard
          label="Households"
          textValue={
            <span className="inline-flex items-center gap-2">
              <Home className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
              {stats.total_households}
            </span>
          }
          tone="neutral"
          hint={`+${stats.new_households_7d} nos últimos 7 dias`}
        />
        <KpiCard
          label="Usuários ativos"
          textValue={
            <span className="inline-flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
              {stats.total_users}
            </span>
          }
          tone="neutral"
          hint={`+${stats.new_users_7d} nos últimos 7 dias`}
        />
        <KpiCard
          label="Assinaturas ativas"
          textValue={
            <span className="inline-flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-olive-600" strokeWidth={1.7} />
              {stats.active_subscriptions}
            </span>
          }
          tone="positive"
          hint={`${stats.trialing} em trial`}
        />
        <KpiCard
          label="Pedidos LGPD"
          textValue={
            <span className="inline-flex items-center gap-2">
              <FileWarning className="w-3.5 h-3.5 text-gold-600" strokeWidth={1.7} />
              {stats.pending_data_requests}
            </span>
          }
          tone={stats.pending_data_requests > 0 ? "negative" : "muted"}
          hint={stats.pending_data_requests > 0 ? "ATENDER em 15d (LGPD)" : "tudo em dia"}
        />
      </div>

      {stats.suspended > 0 ? (
        <Panel className="mb-5 border-rust-600/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-rust-600 font-medium mb-1">
                Atenção
              </div>
              <div className="text-[14px]">
                {stats.suspended} household{stats.suspended === 1 ? "" : "s"} suspenso
                {stats.suspended === 1 ? "" : "s"}
              </div>
            </div>
            <Link
              href="/admin/households?filter=suspended"
              className="text-navy-700 dark:text-navy-300 text-[13px]"
            >
              Ver →
            </Link>
          </div>
        </Panel>
      ) : null}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mb-7">
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
                Atividade recente
              </div>
              <div className="font-mono text-[11.5px] text-faint-foreground mt-0.5">
                últimas 10 ações admin
              </div>
            </div>
            <Link
              href="/admin/audit-log"
              className="text-navy-700 dark:text-navy-300 text-[12.5px]"
            >
              Audit log completo →
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="text-[13px] text-muted-foreground italic">
              Nenhuma ação admin ainda.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {recentAudit.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline justify-between gap-3 text-[12.5px] py-2 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-foreground truncate">
                      {r.action}
                    </div>
                    <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5 truncate">
                      por {r.admin_email ?? "—"}
                      {r.target_household_name
                        ? ` → ${r.target_household_name}`
                        : ""}
                      {r.target_user_email ? ` → ${r.target_user_email}` : ""}
                    </div>
                  </div>
                  <span className="font-mono text-[10.5px] text-faint-foreground shrink-0">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-4">
            Atalhos
          </div>
          <ul className="space-y-2 text-[13.5px]">
            <ShortcutLink href="/admin/households" icon={<Home className="w-3.5 h-3.5" strokeWidth={1.7} />}>
              Gerenciar households
            </ShortcutLink>
            <ShortcutLink href="/admin/users" icon={<Users className="w-3.5 h-3.5" strokeWidth={1.7} />}>
              Gerenciar usuários
            </ShortcutLink>
            <ShortcutLink href="/admin/subscriptions" icon={<CreditCard className="w-3.5 h-3.5" strokeWidth={1.7} />}>
              Assinaturas e billing
            </ShortcutLink>
            <ShortcutLink href="/admin/data-requests" icon={<FileWarning className="w-3.5 h-3.5" strokeWidth={1.7} />}>
              Pedidos LGPD pendentes
            </ShortcutLink>
            <ShortcutLink href="/admin/metrics" icon={<Activity className="w-3.5 h-3.5" strokeWidth={1.7} />}>
              Métricas e DAU
            </ShortcutLink>
          </ul>
        </Panel>
      </div>

      <Panel>
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />
          <div className="text-[13px] leading-relaxed">
            <b>Modelo atual:</b> tudo gratuito para validar o produto.
            Quando estiver pronto pra cobrar, vc seta <code>subscription_tier</code> e{" "}
            <code>subscription_status</code> via UI em{" "}
            <Link href="/admin/subscriptions" className="text-navy-700 dark:text-navy-300">
              Assinaturas
            </Link>{" "}
            ou integra Stripe nos campos preparados em <code>households</code>.
          </div>
        </div>
      </Panel>
    </>
  );
}

function ShortcutLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2.5 px-3 py-2 rounded-[7px] hover:bg-surface-muted transition-colors"
      >
        <span className="text-faint-foreground">{icon}</span>
        <span className="text-foreground">{children}</span>
      </Link>
    </li>
  );
}

// silencia warning de unused se Badge não for usado
export { Badge as _Badge };
