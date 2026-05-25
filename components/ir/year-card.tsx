"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, ArrowRight, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  archiveYear,
  unarchiveYear,
  deleteYearAll,
} from "@/services/ir/year-management.actions";
import { DeleteYearConfirmDialog } from "./delete-year-confirm-dialog";

export type YearCardState =
  | "current"               // ano-base sendo coletado
  | "previous_open"         // ano anterior c/ prazo aberto
  | "previous_closed"       // ano anterior c/ prazo encerrado (histórico)
  | "closed"                // snapshot fechado
  | "historical"            // demais
  | "archived";             // arquivado pelo user

export function YearCard({
  year,
  state,
  hasSnapshot,
  closedAt,
  hasAnyData,
  archiveReason,
}: {
  year: number;
  state: YearCardState;
  hasSnapshot: boolean;
  closedAt: string | null;
  /** Indica se há QUALQUER dado (snapshot, darfs, pagamentos, etc) pra esse ano */
  hasAnyData: boolean;
  archiveReason: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const confirm = useConfirm();

  const stateBadge = getStateBadge(state, closedAt, archiveReason);
  const description = getStateDescription(state, year);

  async function handleArchive() {
    const ok = await confirm({
      title: `Arquivar ano-base ${year}?`,
      description:
        "O ano vai sumir da lista principal mas TODOS os dados ficam preservados " +
        "(snapshots, DARFs, anotações). Você pode desarquivar a qualquer momento.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveYear(year, "user_archived");
      if (r.error) toast.error(r.error);
      else toast.success(`Ano-base ${year} arquivado.`);
    });
  }

  async function handleUnarchive() {
    startTransition(async () => {
      const r = await unarchiveYear(year);
      if (r.error) toast.error(r.error);
      else toast.success(`Ano-base ${year} restaurado.`);
    });
  }

  function handleDeleteClick() {
    setShowDelete(true);
  }

  async function handleConfirmDelete() {
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const r = await deleteYearAll(year, year);
        if (r.error) {
          toast.error(r.error);
          resolve(false);
        } else {
          toast.success(`Ano-base ${year} apagado.`);
          resolve(true);
        }
      });
    });
  }

  // Monta lista de ações conforme estado
  const actions: Parameters<typeof RowActionsMenu>[0]["actions"] = [];
  if (state === "archived") {
    actions.push({
      label: "Desarquivar",
      icon: <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={1.7} />,
      onSelect: handleUnarchive,
      disabled: pending,
    });
  } else if (state !== "current") {
    // Atual nunca arquiva — você está vivendo nele
    actions.push({
      label: "Arquivar (some da lista)",
      icon: <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />,
      onSelect: handleArchive,
      disabled: pending,
    });
  }

  // Excluir só disponível se: NÃO é current E (não tem dados OU tem snapshot)
  if (state !== "current" && hasAnyData) {
    actions.push({
      label: "Excluir tudo do ano",
      icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
      onSelect: handleDeleteClick,
      disabled: pending,
      danger: true,
    });
  } else if (state !== "current" && !hasAnyData) {
    actions.push({
      label: "Excluir (vazio)",
      icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
      onSelect: handleDeleteClick,
      disabled: pending,
      danger: true,
    });
  }

  return (
    <>
      <div className="block group relative">
        <Panel className="!p-6 hover:border-navy-700/40 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-[10px] bg-navy-700/10 grid place-items-center shrink-0">
              <FileText className="w-5 h-5 text-navy-700 dark:text-navy-300" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Link href={`/ir/${year}`} className="font-display text-[22px] tracking-[-0.015em] text-foreground hover:underline">
                  Ano-base {year}
                </Link>
                <span className="font-mono text-[11.5px] text-faint-foreground">
                  · IRPF/{year + 1}
                </span>
                {stateBadge}
              </div>
              <p className="text-[13px] text-muted-foreground mb-3">{description}</p>
              <Link
                href={`/ir/${year}`}
                className="text-navy-700 dark:text-navy-300 text-[13px] inline-flex items-center gap-1 hover:underline"
              >
                Abrir
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
              </Link>
            </div>
            {actions.length > 0 ? (
              <div className="shrink-0">
                <RowActionsMenu actions={actions} />
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <DeleteYearConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        year={year}
        hasSnapshot={hasSnapshot}
        hasAnyData={hasAnyData}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

function getStateBadge(
  state: YearCardState,
  closedAt: string | null,
  archiveReason: string | null,
): React.ReactNode {
  if (state === "archived") {
    return (
      <Badge tone="neutral">
        Arquivado{archiveReason ? ` · ${formatArchiveReason(archiveReason)}` : ""}
      </Badge>
    );
  }
  if (state === "closed" && closedAt) {
    return (
      <Badge tone="olive">
        Fechado em {new Date(closedAt).toLocaleDateString("pt-BR")}
      </Badge>
    );
  }
  if (state === "current") return <Badge tone="navy">Em coleta</Badge>;
  if (state === "previous_open") return <Badge tone="gold">Entrega aberta até maio</Badge>;
  if (state === "previous_closed") return <Badge tone="neutral">Prazo encerrado</Badge>;
  return <Badge tone="neutral">Histórico</Badge>;
}

function formatArchiveReason(reason: string): string {
  if (reason === "user_archived") return "manual";
  if (reason === "entregue_externamente") return "entregue externamente";
  return reason;
}

function getStateDescription(state: YearCardState, year: number): string {
  switch (state) {
    case "current":
      return `Ano em curso. App registra dia-a-dia. Entrega da declaração IRPF/${year + 1} em maio/${year + 1}.`;
    case "previous_open":
      return `Prazo de entrega da declaração IRPF/${year + 1} ainda aberto. Se já entregou via contador, pode arquivar.`;
    case "previous_closed":
      return "Prazo de entrega encerrado. Mantenha pra histórico ou arquive.";
    case "closed":
      return "Snapshot salvo. Pode rever, recalcular DARFs e re-exportar.";
    case "archived":
      return "Arquivado — dados preservados mas escondidos da lista principal.";
    default:
      return "Ano-base histórico.";
  }
}
