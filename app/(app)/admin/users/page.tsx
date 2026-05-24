import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { listAllUsers } from "@/services/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await listAllUsers();
  const active = users.filter((u) => u.is_active);
  const inactive = users.filter((u) => !u.is_active);
  const platformAdmins = users.filter((u) => u.is_platform_admin);

  return (
    <>
      <PageHeader
        eyebrow={`${users.length} usuários · ${platformAdmins.length} superadmin`}
        title={
          <>
            Todos os <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">usuários</em>
          </>
        }
        subtitle="Lista global. Clique em qualquer usuário pra ver detalhes, promover/revogar superadmin, desativar ou apagar."
      />

      <Panel className="!px-0">
        <div className="px-4 sm:px-7 pt-1 flex items-center justify-between mb-3 text-[12.5px] text-faint-foreground font-mono">
          <span>{active.length} ativos · {inactive.length} desativados</span>
        </div>
        <div className="overflow-x-auto px-4 sm:px-7">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Usuário</Th>
                <Th>Email</Th>
                <Th>Household</Th>
                <Th>Role</Th>
                <Th>Último login</Th>
                <Th>Criado</Th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors"
                >
                  <td className="py-3.5 pr-4">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-medium text-[13.5px] text-foreground hover:text-navy-700 dark:hover:text-navy-300"
                    >
                      {u.display_name}
                    </Link>
                    <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
                      {u.id.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-[12px] text-muted-foreground truncate max-w-[260px]">
                    {u.email ?? "—"}
                  </td>
                  <td className="py-3.5 pr-4 text-[13px] truncate max-w-[160px]">
                    {u.household_name ?? "—"}
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      {u.is_platform_admin ? (
                        <Badge tone="gold">Superadmin</Badge>
                      ) : null}
                      <Badge tone={u.role === "admin" ? "navy" : "neutral"}>
                        {u.role === "admin" ? "Admin" : "Member"}
                      </Badge>
                      {!u.is_active ? <Badge tone="rust">Inativo</Badge> : null}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-[11.5px] text-muted-foreground">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-[11.5px] text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="text-right pl-2">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-navy-700 dark:text-navy-300 text-[12.5px] hover:underline"
                    >
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
