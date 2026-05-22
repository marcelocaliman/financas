"use client";

import { useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setRecurringRulesActiveBatch } from "@/services/recurrences.actions";

/**
 * Botão global pra pausar/reativar TUDO. Mostra "Pausar todas" se há
 * alguma ativa; "Reativar todas" se todas estão pausadas. Esconde se
 * não há nenhuma regra.
 */
export function PauseAllButton({
  activeIds,
  pausedIds,
}: {
  activeIds: string[];
  pausedIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const hasActive = activeIds.length > 0;
  const hasPaused = pausedIds.length > 0;
  if (!hasActive && !hasPaused) return null;

  const mode = hasActive ? "pause" : "resume";
  const ids = hasActive ? activeIds : pausedIds;

  const handle = () => {
    const verb = mode === "pause" ? "Pausar" : "Reativar";
    if (!confirm(`${verb} ${ids.length} recorrência${ids.length === 1 ? "" : "s"}?`)) return;
    startTransition(async () => {
      const r = await setRecurringRulesActiveBatch(ids, mode === "resume");
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `${r.updated} ${mode === "resume" ? "reativada" : "pausada"}${(r.updated ?? 0) === 1 ? "" : "s"}.`,
      );
    });
  };

  return (
    <Button variant="ghost" onClick={handle} disabled={pending} aria-label={`${mode === "pause" ? "Pausar" : "Reativar"} todas`}>
      {mode === "pause" ? (
        <>
          <Pause className="w-3.5 h-3.5" strokeWidth={1.7} />
          Pausar tudo
        </>
      ) : (
        <>
          <Play className="w-3.5 h-3.5" strokeWidth={1.7} />
          Reativar tudo
        </>
      )}
    </Button>
  );
}
