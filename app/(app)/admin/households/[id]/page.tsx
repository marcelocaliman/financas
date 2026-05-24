import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import {
  getHouseholdById,
  listHouseholdMembers,
  listAuditLog,
} from "@/services/platform-admin";
import { HouseholdAdminActions } from "@/components/admin/household-admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminHouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [household, members, audit] = await Promise.all([
    getHouseholdById(id),
    listHouseholdMembers(id),
    listAuditLog({ householdId: id, limit: 50 }),
  ]);

  if (!household) notFound();

  return (
    <>
      <Link
        href="/admin/households"
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Todos os households
      </Link>

      <PageHeader
        eyebrow={`ID · ${household.id}`}
        title={
          <>
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              {household.name}
            </em>
          </>
        }
        subtitle={`Plano ${household.subscription_tier} · status ${household.subscription_status} · criado em ${new Date(household.created_at).toLocaleDateString("pt-BR")}`}
      />

      {/* Alerta se suspenso */}
      {household.subscription_status === "suspended" ? (
        <Panel className="mb-5 border-rust-600/30">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-rust-600 font-medium mb-1">
            Suspenso
          </div>
          <div className="text-[13px] mb-1">
            {household.suspended_reason ?? "—"}
          </div>
          <div className="font-mono text-[11px] text-faint-foreground">
            {household.suspended_at
              ? `em ${new Date(household.suspended_at).toLocaleString("pt-BR")}`
              : null}
          </div>
        </Panel>
      ) : null}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mb-5">
        {/* Membros */}
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Membros · {members.length}
          </div>
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-foreground truncate">
                    {m.display_name}
                    {household.created_by === m.id ? (
                      <span className="ml-2">
                        <Badge tone="gold">Criador</Badge>
                      </span>
                    ) : null}
                  </div>
                  <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5">
                    {m.id.slice(0, 8)}… ·{" "}
                    {m.is_active ? "ativo" : "desativado"} · entrou em{" "}
                    {new Date(m.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge tone={m.role === "admin" ? "navy" : "neutral"}>
                  {m.role === "admin" ? "Admin" : "Member"}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Subscription details */}
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Assinatura
          </div>
          <dl className="space-y-2 text-[12.5px] font-mono">
            <Row label="Plano" value={household.subscription_tier} />
            <Row label="Status" value={household.subscription_status} />
            <Row
              label="Início"
              value={
                household.subscription_started_at
                  ? new Date(household.subscription_started_at).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <Row
              label="Renovação"
              value={
                household.subscription_renews_at
                  ? new Date(household.subscription_renews_at).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <Row
              label="Trial até"
              value={
                household.trial_ends_at
                  ? new Date(household.trial_ends_at).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <Row
              label="Stripe customer"
              value={household.stripe_customer_id ?? "—"}
              mono
            />
            <Row
              label="Stripe subscription"
              value={household.stripe_subscription_id ?? "—"}
              mono
            />
          </dl>
        </Panel>
      </div>

      {/* Ações administrativas */}
      <HouseholdAdminActions household={household} />

      {/* Audit log do household */}
      <Panel className="mt-5">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
          Histórico admin neste household
        </div>
        {audit.length === 0 ? (
          <p className="text-[13px] text-muted-foreground italic">
            Nenhuma ação registrada.
          </p>
        ) : (
          <ul className="space-y-2">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between gap-3 py-2 border-b border-border last:border-b-0 text-[12.5px]"
              >
                <div className="min-w-0">
                  <div className="font-mono text-foreground truncate">
                    {a.action}
                  </div>
                  <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5 truncate">
                    {a.admin_email ?? "—"}
                    {a.target_user_email ? ` → ${a.target_user_email}` : ""}
                    {a.details
                      ? ` · ${JSON.stringify(a.details).slice(0, 80)}`
                      : ""}
                  </div>
                </div>
                <span className="font-mono text-[10.5px] text-faint-foreground shrink-0">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-faint-foreground uppercase tracking-[0.12em] text-[10px]">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "text-foreground text-[11px] truncate max-w-[200px]"
            : "text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
