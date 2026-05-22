"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { mergeCategories } from "@/services/categories.actions";
import type { Tables } from "@/types/database";

type Category = Tables<"categories">;

/**
 * Diálogo de merge — escolhe a categoria DESTINO entre as do mesmo kind
 * (excluindo a source). Após confirmar, move todas as transações e regras
 * pra destino, e arquiva a source.
 */
export function MergeCategoryDialog({
  source,
  candidates,
  open,
  onOpenChange,
}: {
  source: Category;
  /** Outras categorias do mesmo kind, não-arquivadas */
  candidates: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [targetId, setTargetId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    if (!targetId) {
      toast.error("Selecione a categoria de destino.");
      return;
    }
    startTransition(async () => {
      const r = await mergeCategories(source.id, targetId);
      if (r.error) toast.error(r.error);
      else {
        toast.success(`Categoria "${source.name}" consolidada.`);
        onOpenChange(false);
        setTargetId("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(460px,calc(100vw-32px))]">
        <DialogHeader
          eyebrow="Consolidar categorias"
          title={
            <>
              Mover tudo de <em className="italic">{source.name}</em> pra…
            </>
          }
          description="Todas as transações e regras recorrentes que estavam em ‘${source.name}’ migram pro destino. A origem é arquivada (não deletada — o histórico fica intacto)."
        />

        {candidates.length === 0 ? (
          <p className="text-[13px] text-faint-foreground italic">
            Não há outras categorias desse tipo pra consolidar.
          </p>
        ) : (
          <div>
            <Label htmlFor="merge-target">Categoria de destino</Label>
            <select
              id="merge-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full h-10 px-3 rounded-[8px] border border-border-strong bg-surface text-[13.5px] text-foreground"
            >
              <option value="">Escolha…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={pending || !targetId || candidates.length === 0}
          >
            {pending ? "Consolidando…" : "Consolidar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
