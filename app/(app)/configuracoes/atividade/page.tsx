import Link from "next/link";
import { ArrowUpRight, Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getRecentActivity } from "@/services/user-activity";

export const dynamic = "force-dynamic";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDate(items: { timestamp: string }[]) {
  const map = new Map<string, typeof items>();
  for (const it of items) {
    const d = it.timestamp.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(it);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export default async function AtividadePage() {
  const items = await getRecentActivity(80);
  const grouped = groupByDate(items as Parameters<typeof groupByDate>[0]);

  return (
    <>
      <PageHeader
        eyebrow="Configurações · atividade"
        title={
          <>
            <Activity className="inline w-6 h-6 mr-2 -mt-1 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
            Mudanças{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              recentes
            </em>
          </>
        }
        subtitle={`Últimas ${items.length} mudanças no app — transações, recorrências, investimentos, contas, metas, dívidas, dedutíveis IR. Útil pra revisar "o que mexi na semana".`}
      />

      {items.length === 0 ? (
        <Panel className="!py-12 text-center text-[13px] text-muted-foreground">
          Nenhuma atividade recente.
        </Panel>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, group]) => (
            <Panel key={date}>
              <PanelHeader
                title={new Date(date).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                meta={`${group.length} mudança${group.length !== 1 ? "s" : ""}`}
              />
              <ul className="divide-y divide-border-strong/30">
                {(group as ReturnType<typeof getRecentActivity> extends Promise<infer T> ? T : never).map((it) => (
                  <li key={`${it.table}-${it.id}`} className="py-2 flex items-center justify-between gap-3 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground px-1.5 py-0.5 rounded border border-border">
                          {it.table}
                        </span>
                        <span
                          className={
                            "font-mono text-[10px] uppercase tracking-[0.1em] " +
                            (it.action === "criado"
                              ? "text-olive-700 dark:text-olive-500"
                              : "text-navy-700 dark:text-navy-300")
                          }
                        >
                          {it.action}
                        </span>
                      </div>
                      <div className="text-[13px] text-foreground truncate mt-0.5">
                        {it.label}
                      </div>
                    </div>
                    <div className="font-mono text-[10.5px] text-muted-foreground tabular-nums shrink-0">
                      {fmtDateTime(it.timestamp)}
                    </div>
                    <Link
                      href={it.href}
                      className="opacity-0 group-hover:opacity-100 text-faint-foreground hover:text-foreground transition-opacity shrink-0"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
