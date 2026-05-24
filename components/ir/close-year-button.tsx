"use client";

import { useTransition } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { closeYearDeclaration } from "@/services/ir/actions";

export function CloseYearButton({
  year,
  isClosed,
}: {
  year: number;
  isClosed: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  const handle = async () => {
    const ok = await confirm({
      title: isClosed ? "Atualizar snapshot do ano-base?" : "Fechar declaração do ano-base?",
      description:
        "Gera (ou substitui) o snapshot dos bens em 31/12. Esse snapshot é usado como 'Situação em 31/12 do ano anterior' na declaração do ano seguinte. Pode refazer quantas vezes quiser.",
      confirmLabel: isClosed ? "Atualizar snapshot" : "Fechar declaração",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await closeYearDeclaration(year);
      if (r.error) toast.error(r.error);
      else {
        toast.success(isClosed ? "Snapshot atualizado." : "Declaração fechada.");
        router.refresh();
      }
    });
  };

  return (
    <Button variant="primary" onClick={handle} disabled={pending}>
      {isClosed ? (
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
      ) : (
        <Lock className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
      )}
      {pending
        ? "Salvando…"
        : isClosed
          ? "Atualizar snapshot"
          : `Fechar declaração ${year}`}
    </Button>
  );
}
