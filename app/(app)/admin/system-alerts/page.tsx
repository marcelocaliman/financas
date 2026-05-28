import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { listAllSystemAlerts } from "@/services/system-alerts";
import { SystemAlertRowActions } from "@/components/admin/system-alert-row-actions";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = {
  severity?: "info" | "warning" | "error";
  kind?: string;
  show?: "unack" | "all";
};

export default async function AdminSystemAlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const onlyUnack = (params.show ?? "unack") === "unack";

  const rows = await listAllSystemAlerts({
    severity: params.severity,
    kind: params.kind,
    onlyUnacknowledged: onlyUnack,
    limit: 500,
  });

  const counts = {
    error: rows.filter((r) => r.severity === "error").length,
    warning: rows.filter((r) => r.severity === "warning").length,
    info: rows.filter((r) => r.severity === "info").length,
    userFacing: rows.filter((r) => r.user_facing).length,
  };

  // Agregação por kind
  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  const topKinds = Array.from(byKind.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow={`${rows.length} ${onlyUnack ? "ainda em aberto" : "registrados"}`}
        title={
          <>
            System <em className="not-italic font-display italic text-rust-700 dark:text-rust-400">alerts</em>
          </>
        }
        subtitle="Falhas em background (cron, server actions, sync) que normalmente não aparecem pro usuário. Marque como acknowledged depois de investigar/resolver."
      />

      {/* Sumário */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <CountCard label="Critical" count={counts.error} icon={AlertCircle} color="rust" />
        <CountCard label="Warnings" count={counts.warning} icon={AlertTriangle} color="gold" />
        <CountCard label="Info" count={counts.info} icon={Info} color="navy" />
        <CountCard label="User-facing" count={counts.userFacing} icon={AlertTriangle} color="olive" />
      </div>

      {/* Filtros */}
      <Panel className="mb-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
          Filtros
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <FilterChip
            href="/admin/system-alerts"
            active={!params.severity && !params.kind && (params.show ?? "unack") === "unack"}
            label="Em aberto"
          />
          <FilterChip
            href="/admin/system-alerts?show=all"
            active={params.show === "all"}
            label="Todos (inc. ack)"
          />
          <span className="w-px h-4 bg-border-strong mx-1" />
          <FilterChip
            href={`/admin/system-alerts?severity=error${params.show === "all" ? "&show=all" : ""}`}
            active={params.severity === "error"}
            label="error"
          />
          <FilterChip
            href={`/admin/system-alerts?severity=warning${params.show === "all" ? "&show=all" : ""}`}
            active={params.severity === "warning"}
            label="warning"
          />
          <FilterChip
            href={`/admin/system-alerts?severity=info${params.show === "all" ? "&show=all" : ""}`}
            active={params.severity === "info"}
            label="info"
          />
          {topKinds.length > 0 ? (
            <>
              <span className="w-px h-4 bg-border-strong mx-1" />
              {topKinds.map(([kind, count]) => (
                <FilterChip
                  key={kind}
                  href={`/admin/system-alerts?kind=${kind}${params.show === "all" ? "&show=all" : ""}`}
                  active={params.kind === kind}
                  label={`${kind} (${count})`}
                />
              ))}
            </>
          ) : null}
        </div>
      </Panel>

      {/* Tabela */}
      {rows.length === 0 ? (
        <Panel className="!py-12 text-center">
          <div className="text-[14px] text-muted-foreground">
            Nada por aqui. Sistema está limpo (ou nenhum alert se encaixa nos filtros).
          </div>
        </Panel>
      ) : (
        <Panel className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em] bg-surface-muted/50">
                  <th className="text-left py-3 px-4 font-medium">Quando</th>
                  <th className="text-left py-3 px-3 font-medium">Sev</th>
                  <th className="text-left py-3 px-3 font-medium">Kind</th>
                  <th className="text-left py-3 px-3 font-medium">Mensagem</th>
                  <th className="text-left py-3 px-3 font-medium">User-facing</th>
                  <th className="text-right py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="py-3 px-4 font-mono text-[11.5px] text-muted-foreground whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <SeverityBadge severity={row.severity} />
                    </td>
                    <td className="py-3 px-3 font-mono text-[11.5px] text-foreground">{row.kind}</td>
                    <td className="py-3 px-3 text-foreground max-w-[400px]">
                      {row.message}
                      {row.context ? (
                        <details className="mt-1.5">
                          <summary className="text-[10.5px] font-mono text-faint-foreground cursor-pointer">
                            context
                          </summary>
                          <pre className="text-[10.5px] font-mono text-faint-foreground bg-surface-muted p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(row.context, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                    <td className="py-3 px-3">
                      {row.user_facing ? (
                        <Badge tone="olive">sim</Badge>
                      ) : (
                        <span className="text-faint-foreground italic text-[11.5px]">não</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <SystemAlertRowActions
                        id={row.id}
                        acknowledged={!!row.acknowledged_at}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

function CountCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: typeof AlertCircle;
  color: "rust" | "gold" | "navy" | "olive";
}) {
  const colors = {
    rust: "text-rust-700 dark:text-rust-400 border-rust-600/30 bg-rust-50 dark:bg-rust-900/15",
    gold: "text-gold-700 dark:text-gold-500 border-gold-600/30 bg-gold-50 dark:bg-gold-900/15",
    navy: "text-navy-700 dark:text-navy-300 border-navy-600/30 bg-navy-50 dark:bg-navy-900/15",
    olive: "text-olive-700 dark:text-olive-500 border-olive-600/30 bg-olive-50 dark:bg-olive-900/15",
  };
  return (
    <div className={`rounded-[10px] border px-4 py-3 ${colors[color]}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" strokeWidth={1.7} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] font-medium">
          {label}
        </span>
      </div>
      <div className="font-mono text-[28px] tabular-nums mt-1">{count}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-mono uppercase tracking-[0.06em] transition-colors ${
        active
          ? "bg-navy-700 text-white"
          : "bg-surface-muted text-muted-foreground hover:bg-surface-muted/70"
      }`}
    >
      {label}
    </Link>
  );
}

function SeverityBadge({ severity }: { severity: "info" | "warning" | "error" }) {
  if (severity === "error") return <Badge tone="rust">error</Badge>;
  if (severity === "warning") return <Badge tone="gold">warning</Badge>;
  return <Badge tone="navy">info</Badge>;
}
