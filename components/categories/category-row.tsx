"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive, RotateCcw, Trash2, ArrowUp, ArrowDown, Merge } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  archiveCategory,
  deleteCategory,
  restoreCategory,
} from "@/services/categories.actions";
import type { Tables } from "@/types/database";
import { CategorySheet } from "./category-sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Sparkline } from "@/components/ui/sparkline";
import { Money } from "@/components/ui/money";
import type { CategoryStats } from "@/services/categories";

type Category = Tables<"categories">;

const kindToTone: Record<string, BadgeTone> = {
  income: "olive",
  expense: "navy",
  transfer: "gold",
};

const kindLabel: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

export function CategoryRow({
  category,
  stats,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onMerge,
}: {
  category: Category;
  stats?: CategoryStats;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMerge?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const handleArchive = async () => {
    const ok = await confirm({
      title: `Arquivar "${category.name}"?`,
      description: "Some das listas mas pode ser restaurada depois.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveCategory(category.id);
      if (r.error) toast.error(r.error);
      else toast.success("Categoria arquivada.");
    });
  };
  const handleRestore = () => {
    startTransition(async () => {
      const r = await restoreCategory(category.id);
      if (r.error) toast.error(r.error);
      else toast.success("Categoria restaurada.");
    });
  };
  const handleDelete = async () => {
    const ok = await confirm({
      eyebrow: "Ação irreversível",
      title: `Excluir "${category.name}" DEFINITIVAMENTE?`,
      description: "Transações vinculadas ficam sem categoria.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteCategory(category.id);
      if (r.error) toast.error(r.error);
      else toast.success("Categoria excluída.");
    });
  };

  // Tendência: compara o último mês com a média dos meses anteriores
  const trend =
    stats && stats.byMonth.length >= 2
      ? (() => {
          const last = stats.byMonth[stats.byMonth.length - 1];
          const previous =
            stats.byMonth.slice(0, -1).reduce((s, v) => s + v, 0) /
            (stats.byMonth.length - 1);
          if (previous <= 0) return null;
          return (last - previous) / previous;
        })()
      : null;

  return (
    <>
      <div className="flex items-center gap-4 px-1 py-3 border-b border-border last:border-b-0 group">
        <div className="flex-1 min-w-0 flex items-center gap-3 min-w-0">
          {category.icon ? (
            <span
              className="font-mono text-[14px] shrink-0"
              style={category.color ? { color: category.color } : undefined}
            >
              {category.icon}
            </span>
          ) : category.color ? (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: category.color }}
            />
          ) : null}
          <span className="font-medium text-[14px] text-foreground tracking-[-0.005em] truncate">
            {category.name}
          </span>
          <Badge tone={kindToTone[category.kind]} dot>
            {kindLabel[category.kind]}
          </Badge>
          {category.is_archived ? <Badge tone="gold">Arquivada</Badge> : null}
        </div>

        {stats && !category.is_archived ? (
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground">
                Média/mês
              </div>
              <Money
                value={stats.monthlyAverage}
                className="font-mono text-[12.5px] text-foreground tabular-nums inline-flex !flex-row !items-baseline"
              />
            </div>
            {trend != null && Math.abs(trend) > 0.05 ? (
              <span
                className={
                  "font-mono text-[11px] tabular-nums " +
                  (trend > 0
                    ? category.kind === "expense"
                      ? "text-rust-600"
                      : "text-olive-700 dark:text-olive-500"
                    : category.kind === "expense"
                      ? "text-olive-700 dark:text-olive-500"
                      : "text-rust-600")
                }
                title={
                  trend > 0
                    ? "Subindo vs meses anteriores"
                    : "Caindo vs meses anteriores"
                }
              >
                {trend > 0 ? "↑" : "↓"} {Math.abs(trend * 100).toFixed(0)}%
              </span>
            ) : null}
            {stats.byMonth.length >= 2 ? (
              <Sparkline
                data={stats.byMonth}
                width={80}
                height={20}
                stroke={
                  category.kind === "income"
                    ? "rgba(115,136,81,0.7)"
                    : "rgba(96,126,168,0.7)"
                }
                strokeWidth={1.4}
                showDot={false}
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          {category.is_archived ? (
            <>
              <Button size="sm" variant="ghost" disabled={pending} onClick={handleRestore}>
                <RotateCcw className="w-3 h-3" strokeWidth={1.7} />
                Restaurar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={handleDelete}
                aria-label="Excluir definitivamente"
                className="text-rust-600"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
              </Button>
            </>
          ) : (
            <>
              {onMoveUp ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onMoveUp}
                  disabled={!canMoveUp || pending}
                  aria-label="Mover pra cima"
                  className="opacity-0 group-hover:opacity-100 disabled:!opacity-20"
                >
                  <ArrowUp className="w-3.5 h-3.5" strokeWidth={1.7} />
                </Button>
              ) : null}
              {onMoveDown ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onMoveDown}
                  disabled={!canMoveDown || pending}
                  aria-label="Mover pra baixo"
                  className="opacity-0 group-hover:opacity-100 disabled:!opacity-20"
                >
                  <ArrowDown className="w-3.5 h-3.5" strokeWidth={1.7} />
                </Button>
              ) : null}
              {onMerge ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onMerge}
                  disabled={pending}
                  aria-label="Consolidar com outra categoria"
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Merge className="w-3.5 h-3.5" strokeWidth={1.7} />
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditing(true)}
                aria-label="Editar"
                className="opacity-0 group-hover:opacity-100"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={handleArchive}
                aria-label="Arquivar"
                className="opacity-0 group-hover:opacity-100 text-rust-600"
              >
                <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={handleDelete}
                aria-label="Excluir definitivamente"
                className="opacity-0 group-hover:opacity-100 text-rust-600"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
              </Button>
            </>
          )}
        </div>
      </div>
      <CategorySheet open={editing} onOpenChange={setEditing} category={category} />
    </>
  );
}
