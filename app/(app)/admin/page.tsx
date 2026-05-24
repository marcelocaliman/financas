import Link from "next/link";
import { Home, Users, CreditCard, FileWarning, Activity, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { getPlatformStats, listAuditLog } from "@/services/platform-admin";
import {
  getActionVolume,
  getDAUWAUMAU,
  getHouseholdGrowth,
  getUserGrowth,
} from "@/services/admin-metrics";
import { GrowthChart } from "@/components/admin/growth-chart";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [
    stats,
    recentAudit,
    householdGrowth,
    userGrowth,
    actionVolume,
    dauwaumau,
  ] = await Promise.all([
    getPlatformStats(),
    listAuditLog({ limit: 10 }),
    getHouseholdGrowth(30),
    getUserGrowth(30),
    getActionVolume(30),
    getDAUWAUMAU(),
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
        subtitle="Visão geral em tempo real: households, usuários, engajamento, billing e atividade admin."
      />

      {/* KPIs primários */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <KpiCard
          label="Households"
          textValue={`${stats.total_households}`}
          tone="neutral"
          hint={`+${stats.new_households_7d} em 7d`}
        />
        <KpiCard
          label="Usuários"
          textValue={`${stats.total_users}`}
          tone="neutral"
          hint={`+${stats.new_users_7d} em 7d`}
        />
        <KpiCard
          label="Ativos hoje (DAU)"
          textValue={`${dauwaumau.dau}`}
          tone="positive"
          hint={`MAU ${dauwaumau.mau} · stickiness ${(dauwaumau.stickiness * 100).toFixed(0)}%`}
        />
        <KpiCard
          label="Pedidos LGPD"
          textValue={`${stats.pending_data_requests}`}
          tone={stats.pending_data_requests > 0 ? "negative" : "muted"}
          hint={stats.pending_data_requests > 0 ? "ATENDER em 15d" : "tudo em dia"}
        />
      </div>

      {/* Charts crescimento — 30 dias */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Households (30 dias)
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            Crescimento cumulativo
          </p>
          <GrowthChart
            data={householdGrowth}
            label="Households"
            color="var(--color-navy-700)"
            cumulative
          />
        </Panel>

        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Usuários (30 dias)
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            Crescimento cumulativo
          </p>
          <GrowthChart
            data={userGrowth}
            label="Usuários"
            color="var(--color-olive-600)"
            cumulative
          />
        </Panel>
      </div>

      {/* Charts engajamento + admin */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Engajamento
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            DAU / WAU / MAU
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Stat label="DAU" value={dauwaumau.dau} hint="hoje" />
            <Stat label="WAU" value={dauwaumau.wau} hint="7 dias" />
            <Stat label="MAU" value={dauwaumau.mau} hint="30 dias" />
          </div>
          <div className="mt-4 pt-4 border-t border-border text-[12.5px] text-muted-foreground">
            <b>Stickiness DAU/MAU:</b>{" "}
            <span className="font-mono text-foreground">
              {(dauwaumau.stickiness * 100).toFixed(0)}%
            </span>{" "}
            — quanto maior, mais o usuário volta diariamente
          </div>
        </Panel>

        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Ações admin (30 dias)
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-3">
            Volume de operações administrativas
          </p>
          <GrowthChart
            data={actionVolume}
            label="Ações"
            color="var(--color-gold-600)"
          />
        </Panel>
      </div>

      {/* Status crítico */}
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

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mb-5">
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
                      {r.target_household_name ? ` → ${r.target_household_name}` : ""}
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
              Métricas detalhadas
            </ShortcutLink>
          </ul>
        </Panel>
      </div>

      <Panel className="border-navy-700/30">
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

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div className="font-mono text-[24px] tabular-nums text-foreground mt-1">{value}</div>
      {hint ? (
        <div className="font-mono text-[10px] text-faint-foreground mt-0.5">{hint}</div>
      ) : null}
    </div>
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
