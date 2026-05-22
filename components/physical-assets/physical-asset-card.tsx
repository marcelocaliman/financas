"use client";

import { useState, useTransition } from "react";
import { Archive, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import {
  archivePhysicalAsset,
  deletePhysicalAsset,
  restorePhysicalAsset,
} from "@/services/physical-assets.actions";
import { CATEGORY_LABELS } from "@/lib/financial/asset-categories";
import { formatMoney } from "@/lib/utils/format";
import { Money } from "@/components/ui/money";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { cn } from "@/lib/utils/cn";
import type { Tables } from "@/types/database";
import { PhysicalAssetSheet } from "./physical-asset-sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Asset = Tables<"physical_assets">;

export function PhysicalAssetCard({ asset }: { asset: Asset }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const handleArchive = async () => {
    const ok = await confirm({
      title: `Arquivar "${asset.name}"?`,
      description: "Some das listas mas o histórico fica.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archivePhysicalAsset(asset.id);
      if (r.error) toast.error(r.error);
      else toast.success("Bem arquivado.");
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const r = await restorePhysicalAsset(asset.id);
      if (r.error) toast.error(r.error);
      else toast.success("Bem restaurado.");
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      eyebrow: "Ação irreversível",
      title: `Excluir "${asset.name}" DEFINITIVAMENTE?`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deletePhysicalAsset(asset.id);
      if (r.error) toast.error(r.error);
      else toast.success("Bem excluído.");
    });
  };

  const acquired = Number(asset.acquired_value ?? 0);
  const current = Number(asset.current_value ?? 0);
  const delta = current - acquired;
  const deltaPct = acquired > 0 ? delta / acquired : null;

  return (
    <>
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border bg-surface p-6 relative group transition-shadow",
          asset.is_active ? "border-border hover:shadow-sm" : "border-dashed border-border-strong opacity-70",
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge tone="navy">{CATEGORY_LABELS[asset.category]}</Badge>
              {!asset.is_active ? <Badge tone="gold">Arquivado</Badge> : null}
            </div>
            <div className="font-display text-[19px] tracking-[-0.015em] text-foreground truncate">
              {asset.name}
            </div>
            {asset.description ? (
              <div className="text-[12.5px] text-muted-foreground mt-1 line-clamp-2">
                {asset.description}
              </div>
            ) : null}
          </div>

          {asset.is_active ? (
            <RowActionsMenu
              actions={[
                {
                  label: "Editar",
                  icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setEditing(true),
                  disabled: pending,
                },
                {
                  label: "Arquivar",
                  icon: <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleArchive,
                  disabled: pending,
                  danger: true,
                },
                {
                  label: "Excluir definitivamente",
                  icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleDelete,
                  disabled: pending,
                  danger: true,
                },
              ]}
            />
          ) : (
            <button
              type="button"
              onClick={handleRestore}
              disabled={pending}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-foreground hover:text-navy-700"
            >
              <RotateCcw className="w-3 h-3" strokeWidth={1.7} />
              Restaurar
            </button>
          )}
        </div>

        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
          Valor atual
        </div>
        <Money
          value={current}
          currency={asset.currency}
          className="text-[24px] tracking-[-0.02em] mt-1 text-foreground items-start"
        />

        {acquired > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-mono">
            <span className="text-muted-foreground">
              Pago: <MoneyMask>{formatMoney(acquired, asset.currency)}</MoneyMask>
            </span>
            {deltaPct != null && Math.abs(deltaPct) > 0.001 ? (
              <span
                className={
                  delta > 0
                    ? "text-olive-700 dark:text-olive-500"
                    : "text-rust-600"
                }
              >
                {delta >= 0 ? "+" : ""}
                {(deltaPct * 100).toFixed(1).replace(".", ",")}% vs aquisição
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <PhysicalAssetSheet open={editing} onOpenChange={setEditing} asset={asset} />
    </>
  );
}
