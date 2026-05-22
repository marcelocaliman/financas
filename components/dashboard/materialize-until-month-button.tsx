"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { materializeRecurrenceNow } from "@/services/recurrences.actions";

/**
 * Botão que aparece quando o usuário navega pra um mês futuro no dashboard.
 * Materializa todas as regras ativas até o último dia do mês selecionado,
 * populando o futuro com as ocorrências previstas das recorrências.
 *
 * Ex: navega pra dezembro/2026, clica → o aluguel, salário, Netflix etc
 * que cairão até 31/12 são criados como transactions agora.
 */
export function MaterializeUntilMonthButton({
  monthLabel,
  untilDate, // YYYY-MM-DD (último dia do mês selecionado)
}: {
  monthLabel: string;
  untilDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handle = () => {
    if (
      !confirm(
        `Materializar todas as recorrências ativas até ${monthLabel}? Cria os lançamentos previstos pelas regras de aluguel, salário, assinaturas etc.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await materializeRecurrenceNow(undefined, untilDate);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if ((r.created ?? 0) === 0) {
        toast.success("Nada novo pra criar.");
      } else {
        toast.success(
          `${r.created} lançamento${r.created === 1 ? "" : "s"} previsto${r.created === 1 ? "" : "s"} criado${r.created === 1 ? "" : "s"}.`,
        );
        router.refresh();
      }
    });
  };

  return (
    <Button variant="primary" onClick={handle} disabled={pending}>
      <Sparkles className="w-3.5 h-3.5" strokeWidth={1.7} />
      {pending ? "Materializando…" : `Prever até ${monthLabel}`}
    </Button>
  );
}
