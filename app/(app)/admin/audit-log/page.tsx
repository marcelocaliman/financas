import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { listAuditLog } from "@/services/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const rows = await listAuditLog({ limit: 500 });

  return (
    <>
      <PageHeader
        eyebrow={`${rows.length} ações registradas`}
        title={
          <>
            Audit <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">log</em>
          </>
        }
        subtitle="Histórico imutável de toda ação de superadmin. Rastreia quem, quando, em qual household, o quê e contexto JSON. Crítico pra LGPD + governança."
      />

      <Panel className="!px-0">
        <div className="overflow-x-auto px-4 sm:px-7">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border">
                <Th>Quando</Th>
                <Th>Admin</Th>
                <Th>Ação</Th>
                <Th>Alvo</Th>
                <Th>Detalhes</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-faint-foreground italic">
                    Sem ações registradas ainda.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors align-top"
                  >
                    <td className="py-3 pr-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11.5px] truncate max-w-[200px]">
                      {r.admin_email ?? "—"}
                    </td>
                    <td className="py-3 pr-3 font-mono font-medium text-foreground whitespace-nowrap">
                      {r.action}
                    </td>
                    <td className="py-3 pr-3 text-[12px]">
                      {r.target_household_name ? (
                        <div className="truncate max-w-[180px]">
                          {r.target_household_name}
                        </div>
                      ) : null}
                      {r.target_user_email ? (
                        <div className="font-mono text-[10.5px] text-faint-foreground truncate max-w-[180px]">
                          {r.target_user_email}
                        </div>
                      ) : null}
                      {!r.target_household_name && !r.target_user_email ? (
                        <span className="text-faint-foreground">—</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[10.5px] text-muted-foreground max-w-[260px] truncate">
                      {r.details ? JSON.stringify(r.details) : "—"}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[10.5px] text-faint-foreground whitespace-nowrap">
                      {r.ip_address ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground pb-3 font-medium text-left pr-3">
      {children}
    </th>
  );
}
