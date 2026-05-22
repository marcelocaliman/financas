"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive, RotateCcw, Trash2 } from "lucide-react";
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

export function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleArchive = () => {
    if (!confirm(`Arquivar a categoria "${category.name}"?`)) return;
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
  const handleDelete = () => {
    if (
      !confirm(
        `Excluir "${category.name}" DEFINITIVAMENTE? Transações vinculadas ficam sem categoria.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteCategory(category.id);
      if (r.error) toast.error(r.error);
      else toast.success("Categoria excluída.");
    });
  };

  return (
    <>
      <div className="flex items-center gap-4 px-1 py-3 border-b border-border last:border-b-0 group">
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="font-medium text-[14px] text-foreground tracking-[-0.005em] truncate">
            {category.name}
          </span>
          <Badge tone={kindToTone[category.kind]} dot>
            {kindLabel[category.kind]}
          </Badge>
          {category.is_archived ? <Badge tone="gold">Arquivada</Badge> : null}
        </div>
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
