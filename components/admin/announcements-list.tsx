"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2, ExternalLink } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { deleteAnnouncement } from "@/services/announcements.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { Announcement } from "@/services/announcements";

export function AnnouncementsList({
  announcements,
}: {
  announcements: Announcement[];
}) {
  if (announcements.length === 0) {
    return (
      <Panel className="!py-14 grid place-items-center text-center">
        <div className="text-[13px] text-muted-foreground">
          Nenhum anúncio ainda. Use o form acima pra criar.
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <AnnRow key={a.id} announcement={a} />
      ))}
    </div>
  );
}

function AnnRow({ announcement: a }: { announcement: Announcement }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const now = Date.now();
  const isActive =
    (!a.starts_at || new Date(a.starts_at).getTime() <= now) &&
    (!a.ends_at || new Date(a.ends_at).getTime() >= now);

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Apagar "${a.title}"?`,
      description: "Some pra todos os usuários.",
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteAnnouncement(a.id);
      if (r.error) toast.error(r.error);
      else toast.success("Apagado.");
    });
  };

  const severityTone =
    a.severity === "critical" ? "rust" : a.severity === "warning" ? "gold" : "navy";

  return (
    <Panel
      className={
        "!p-5 " +
        (a.severity === "critical"
          ? "border-rust-600/30"
          : a.severity === "warning"
            ? "border-gold-600/30"
            : "")
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge tone={severityTone}>{a.severity}</Badge>
            {isActive ? <Badge tone="olive">ATIVO</Badge> : <Badge tone="neutral">inativo</Badge>}
            {a.target_tier ? <Badge tone="gold">só {a.target_tier}</Badge> : null}
            {a.dismissible ? <Badge tone="neutral">dispensável</Badge> : <Badge tone="rust">fixo</Badge>}
          </div>
          <div className="font-display text-[16px] tracking-[-0.01em] text-foreground mb-1">
            {a.title}
          </div>
          {a.body ? (
            <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-2">
              {a.body}
            </p>
          ) : null}
          {a.link_url ? (
            <a
              href={a.link_url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-[12px] text-navy-700 dark:text-navy-300 hover:underline"
            >
              {a.link_label ?? "Link"}
              <ExternalLink className="w-3 h-3" strokeWidth={1.8} />
            </a>
          ) : null}
          <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-2">
            Criado em {new Date(a.created_at).toLocaleString("pt-BR")}
            {a.starts_at
              ? ` · começa ${new Date(a.starts_at).toLocaleString("pt-BR")}`
              : ""}
            {a.ends_at
              ? ` · termina ${new Date(a.ends_at).toLocaleString("pt-BR")}`
              : ""}
          </div>
        </div>
        <Tooltip content="Apagar anúncio">
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            onClick={handleDelete}
            className="text-rust-600"
            aria-label="Apagar"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
          </Button>
        </Tooltip>
      </div>
    </Panel>
  );
}
