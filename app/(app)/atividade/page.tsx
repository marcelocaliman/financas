import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { getActivityLog, type ActivityLogEntry } from "@/services/activity-log";
import { ActivityLogList } from "@/components/activity/activity-log-list";

export const dynamic = "force-dynamic";

function groupByDate(items: ActivityLogEntry[]): Array<[string, ActivityLogEntry[]]> {
  const map = new Map<string, ActivityLogEntry[]>();
  for (const it of items) {
    const d = it.created_at.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(it);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export default async function AtividadePage() {
  // 400 cobre o backfill histórico (~220 hoje) com folga. Paginação fica pra
  // quando o log crescer muito; por ora um teto generoso mostra tudo.
  const items = await getActivityLog(400);
  const groups = groupByDate(items);

  return (
    <>
      <PageHeader
        eyebrow="Transações · histórico"
        title={
          <>
            <Activity className="inline w-6 h-6 mr-2 -mt-1 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
            Atividade{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              de tudo
            </em>
          </>
        }
        subtitle="Toda criação, edição e exclusão que você faz no app — transações, contas, investimentos, recorrências, metas, dívidas, bens, deduções. Cada item tem o botão Desfazer pra reverter uma ação errada."
      />

      {items.length === 0 ? (
        <Panel className="!py-12 text-center text-[13px] text-muted-foreground">
          Nenhuma mudança registrada ainda. Assim que você criar, editar ou excluir
          algo, aparece aqui — com a opção de <b className="text-foreground">desfazer</b>.
        </Panel>
      ) : (
        <ActivityLogList groups={groups} />
      )}
    </>
  );
}
