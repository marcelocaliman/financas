import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { listAllHouseholds } from "@/services/platform-admin";

export const dynamic = "force-dynamic";

type SearchParams = { filter?: string };

export default async function AdminHouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filter } = await searchParams;
  const all = await listAllHouseholds();
  const rows =
    filter === "suspended"
      ? all.filter((r) => r.subscription_status === "suspended")
      : filter === "trialing"
        ? all.filter((r) => r.subscription_status === "trialing")
        : all;

  return (
    <>
      <PageHeader
        eyebrow={`${all.length} households no sistema`}
        title={
          <>
            Todos os <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">households</em>
          </>
        }
        subtitle="Lista global. Clique em qualquer household pra ver detalhes, membros, ações administrativas e logs."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <FilterTab href="/admin/households" label="Todos" count={all.length} active={!filter} />
        <FilterTab
          href="/admin/households?filter=trialing"
          label="Trial"
          count={all.filter((r) => r.subscription_status === "trialing").length}
          active={filter === "trialing"}
        />
        <FilterTab
          href="/admin/households?filter=suspended"
          label="Suspensos"
          count={all.filter((r) => r.subscription_status === "suspended").length}
          active={filter === "suspended"}
          tone="rust"
        />
      </div>

      <Panel className="!px-0">
        <div className="overflow-x-auto px-4 sm:px-7">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Household</Th>
                <Th>Plano · Status</Th>
                <Th right>Membros</Th>
                <Th>Última atividade</Th>
                <Th>Criado em</Th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-faint-foreground italic text-[13px]">
                    Nenhum household nesse filtro.
                  </td>
                </tr>
              ) : (
                rows.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors"
                  >
                    <td className="py-3.5 pr-4">
                      <Link
                        href={`/admin/households/${h.id}`}
                        className="font-medium text-[13.5px] text-foreground hover:text-navy-700 dark:hover:text-navy-300"
                      >
                        {h.name}
                      </Link>
                      <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
                        {h.id.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <TierBadge tier={h.subscription_tier} />
                        <StatusBadge status={h.subscription_status} />
                      </div>
                    </td>
                    <td className="text-right font-mono text-[13px] tabular-nums">
                      {h.member_count}
                    </td>
                    <td className="py-3.5 pr-4 font-mono text-[11.5px] text-muted-foreground">
                      {h.last_activity_at
                        ? new Date(h.last_activity_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="py-3.5 pr-4 font-mono text-[11.5px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="text-right pl-2">
                      <Link
                        href={`/admin/households/${h.id}`}
                        className="text-navy-700 dark:text-navy-300 text-[12.5px] hover:underline"
                      >
                        Abrir →
                      </Link>
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

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground pb-3 font-medium ${
        right ? "text-right pl-3" : "text-left pr-3"
      }`}
    >
      {children}
    </th>
  );
}

function FilterTab({
  href,
  label,
  count,
  active,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone?: "rust";
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors " +
        (active
          ? tone === "rust"
            ? "bg-rust-600/15 text-rust-600 border border-rust-600/30"
            : "bg-surface text-foreground border border-border-strong"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {label}
      <span className="font-mono text-[10.5px] text-faint-foreground">{count}</span>
    </Link>
  );
}

function TierBadge({
  tier,
}: {
  tier: "free" | "pro" | "family" | "lifetime";
}) {
  const map = {
    free: { tone: "neutral" as const, label: "Free" },
    pro: { tone: "navy" as const, label: "Pro" },
    family: { tone: "gold" as const, label: "Family" },
    lifetime: { tone: "olive" as const, label: "Lifetime" },
  };
  return <Badge tone={map[tier].tone}>{map[tier].label}</Badge>;
}

function StatusBadge({
  status,
}: {
  status: "active" | "trialing" | "past_due" | "cancelled" | "suspended";
}) {
  const map = {
    active: { tone: "olive" as const, label: "Ativo" },
    trialing: { tone: "navy" as const, label: "Trial" },
    past_due: { tone: "gold" as const, label: "Vencido" },
    cancelled: { tone: "neutral" as const, label: "Cancelado" },
    suspended: { tone: "rust" as const, label: "Suspenso" },
  };
  return <Badge tone={map[status].tone}>{map[status].label}</Badge>;
}
