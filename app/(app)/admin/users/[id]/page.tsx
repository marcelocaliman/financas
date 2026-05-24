import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { getUserById, listAuditLog } from "@/services/platform-admin";
import { UserAdminActions } from "@/components/admin/user-admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const audit = await listAuditLog({ limit: 50 });
  const userAudit = audit.filter(
    (a) => a.target_user_id === id || a.admin_user_id === id,
  );

  return (
    <>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Todos os usuários
      </Link>

      <PageHeader
        eyebrow={`ID · ${user.id}`}
        title={
          <>
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              {user.display_name}
            </em>
          </>
        }
        subtitle={user.email ?? "sem email"}
      />

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5 mb-5">
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Identidade
          </div>
          <dl className="space-y-2 text-[12.5px] font-mono">
            <Row label="Email" value={user.email ?? "—"} />
            <Row label="Display name" value={user.display_name} />
            <Row label="Household" value={user.household_name ?? "—"} />
            <Row label="Role" value={user.role} />
            <Row
              label="Superadmin"
              value={user.is_platform_admin ? "sim" : "não"}
            />
            <Row label="Ativo" value={user.is_active ? "sim" : "não"} />
            {user.deactivated_reason ? (
              <Row label="Motivo deactivação" value={user.deactivated_reason} />
            ) : null}
            <Row
              label="Criado em"
              value={new Date(user.created_at).toLocaleString("pt-BR")}
            />
            <Row
              label="Último login"
              value={
                user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString("pt-BR")
                  : "—"
              }
            />
          </dl>
        </Panel>

        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Atividade recente
          </div>
          {userAudit.length === 0 ? (
            <p className="text-[13px] text-muted-foreground italic">
              Sem ações admin relacionadas a este usuário.
            </p>
          ) : (
            <ul className="space-y-2">
              {userAudit.slice(0, 10).map((a) => (
                <li
                  key={a.id}
                  className="text-[12.5px] py-1.5 border-b border-border last:border-b-0"
                >
                  <div className="font-mono text-foreground">{a.action}</div>
                  <div className="font-mono text-[10.5px] text-faint-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <UserAdminActions user={user} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-faint-foreground uppercase tracking-[0.12em] text-[10px]">
        {label}
      </dt>
      <dd className="text-foreground text-right truncate max-w-[260px]">
        {value}
      </dd>
    </div>
  );
}

function _Badge() {
  // silenciar import implícito do tooling
  return Badge;
}
