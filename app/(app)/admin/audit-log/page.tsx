import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { listAuditLog } from "@/services/platform-admin";
import { getActionVolume } from "@/services/admin-metrics";
import { GrowthChart } from "@/components/admin/growth-chart";

export const dynamic = "force-dynamic";

type SearchParams = {
  action?: string;
  q?: string;
};

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [allRows, volume] = await Promise.all([
    listAuditLog({ limit: 500, action: params.action || undefined }),
    getActionVolume(30),
  ]);

  // Filtro client-side por search query
  const q = (params.q ?? "").toLowerCase();
  const rows = q
    ? allRows.filter(
        (r) =>
          r.action.toLowerCase().includes(q) ||
          r.admin_email?.toLowerCase().includes(q) ||
          r.target_household_name?.toLowerCase().includes(q) ||
          r.target_user_email?.toLowerCase().includes(q) ||
          JSON.stringify(r.details ?? {}).toLowerCase().includes(q),
      )
    : allRows;

  // Agregação de ações pra mostrar tipos mais comuns
  const actionCounts = new Map<string, number>();
  for (const r of allRows) actionCounts.set(r.action, (actionCounts.get(r.action) ?? 0) + 1);
  const topActions = Array.from(actionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow={`${allRows.length} ações registradas`}
        title={
          <>
            Audit <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">log</em>
          </>
        }
        subtitle="Histórico imutável de toda ação de superadmin. Rastreia quem, quando, em qual household, o quê, IP e contexto JSON."
      />

      {/* Chart de volume */}
      <Panel className="mb-5">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Volume de ações (30 dias)
        </div>
        <p className="text-[11.5px] text-faint-foreground mb-3">
          Quantas ações admin por dia
        </p>
        <GrowthChart data={volume} label="Ações" color="var(--color-gold-600)" />
      </Panel>

      {/* Ações mais frequentes */}
      {topActions.length > 0 ? (
        <Panel className="mb-5">
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Ações mais frequentes
          </div>
          <div className="flex flex-wrap gap-2">
            {topActions.map(([action, count]) => (
              <FilterChip
                key={action}
                href={`/admin/audit-log?action=${action}`}
                active={params.action === action}
                label={action}
                count={count}
              />
            ))}
            {params.action ? (
              <FilterChip
                href="/admin/audit-log"
                active={false}
                label="× limpar filtro"
                count={null}
              />
            ) : null}
          </div>
        </Panel>
      ) : null}

      {/* Search bar */}
      <form action="/admin/audit-log" method="get" className="mb-5 flex gap-2">
        {params.action ? (
          <input type="hidden" name="action" value={params.action} />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar email, household, contexto…"
          className="flex-1 h-10 rounded-[8px] border border-border-strong bg-surface px-3 text-[14px] text-foreground placeholder:text-faint-foreground focus:outline-none focus:border-navy-500"
        />
        <button
          type="submit"
          className="px-4 h-10 rounded-[8px] bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800"
        >
          Buscar
        </button>
      </form>

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
                    {q || params.action
                      ? "Nada bate com esse filtro."
                      : "Sem ações registradas ainda."}
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

import Link from "next/link";

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number | null;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] text-[11.5px] font-mono transition-colors " +
        (active
          ? "bg-navy-700 text-white"
          : "bg-surface border border-border text-foreground hover:bg-surface-muted")
      }
    >
      {label}
      {count != null ? (
        <span className={active ? "opacity-80" : "text-faint-foreground"}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}
