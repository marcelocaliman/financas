"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Undo2, CornerUpLeft } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { undoActivity } from "@/services/activity-log.actions";
import { describeActivity } from "@/lib/activity-describe";
import { formatDateFull, formatMoneyParts } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ActivityLogEntry } from "@/services/activity-log";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const ACTION_ICON = {
  insert: { Icon: Plus, cls: "text-olive-700 dark:text-olive-500" },
  update: { Icon: Pencil, cls: "text-navy-700 dark:text-navy-300" },
  delete: { Icon: Trash2, cls: "text-rust-600" },
} as const;

export function ActivityLogList({
  groups,
}: {
  groups: Array<[string, ActivityLogEntry[]]>;
}) {
  return (
    <div className="space-y-4">
      {groups.map(([date, items]) => (
        <Panel key={date}>
          <PanelHeader
            title={formatDateFull(date)}
            meta={`${items.length} ${items.length === 1 ? "mudança" : "mudanças"}`}
          />
          <ul className="divide-y divide-border">
            {items.map((e) => (
              <ActivityRow key={e.id} entry={e} />
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const { title, amount, direction, currency } = describeActivity(entry);
  const { Icon, cls } = ACTION_ICON[entry.action];
  const undone = entry.undone_at != null;
  const actor = entry.actor?.display_name;

  const hasAmount = amount != null && Number.isFinite(amount);
  const parts = hasAmount ? formatMoneyParts(amount, currency ?? "BRL") : null;
  const amountClass = direction === "in" ? "text-olive-700 dark:text-olive-500" : "text-foreground";
  const amountPrefix = direction === "in" ? "+ " : direction === "out" ? "− " : "";

  const handleUndo = async () => {
    const ok = await confirm({
      eyebrow: "Desfazer",
      title: `Desfazer: ${title}?`,
      description:
        entry.action === "delete"
          ? "Recria o item exatamente como estava antes da exclusão."
          : entry.action === "insert"
            ? "Remove o item que foi criado nesta ação."
            : "Restaura os valores que o item tinha antes desta edição.",
      confirmLabel: "Desfazer",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await undoActivity(entry.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Ação desfeita.");
        router.refresh();
      }
    });
  };

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3",
        undone && "opacity-55",
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", cls)} strokeWidth={1.8} />
      <div className="min-w-0">
        <div className={cn("text-[13.5px] text-foreground truncate", undone && "line-through")}>
          {title}
        </div>
        <div className="font-mono text-[11px] text-faint-foreground tracking-[0.03em] mt-0.5 truncate">
          {fmtTime(entry.created_at)}
          {actor ? <> · {actor}</> : <> · sistema</>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {parts ? (
          <span
            className={cn(
              "font-mono text-[15px] font-semibold tracking-[-0.01em] tabular-nums leading-none",
              amountClass,
              undone && "line-through opacity-60",
            )}
          >
            {amountPrefix}
            {parts.currency}{" "}
            <MoneyMask>
              {parts.integer},{parts.cents}
            </MoneyMask>
          </span>
        ) : null}
        {undone ? (
          <Badge tone="neutral">
            <CornerUpLeft className="w-3 h-3" strokeWidth={1.8} />
            Desfeito
          </Badge>
        ) : (
          <Tooltip content="Desfazer esta ação">
            <button
              type="button"
              onClick={handleUndo}
              disabled={pending}
              aria-label="Desfazer"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 -mr-1 rounded-[6px] text-[11px] text-muted-foreground hover:text-foreground hover:bg-bone-100 dark:hover:bg-ink-800 transition-colors disabled:opacity-40"
            >
              <Undo2 className="w-3 h-3" strokeWidth={1.7} />
              {pending ? "…" : "Desfazer"}
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}
