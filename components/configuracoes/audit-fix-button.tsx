"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { generateExclusiveIncomeFromClosures } from "@/services/audit.actions";

/**
 * Botão que dispara a server action de auto-fix referenciada por um Finding.
 * Quando a action retorna sucesso, recarrega a página pra refletir o novo
 * estado do dashboard.
 */
export function AuditFixButton({
  action,
  label,
}: {
  action: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      if (action === "generate-exclusive-income-from-closures") {
        const r = await generateExclusiveIncomeFromClosures();
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toast.success(`${r.generated ?? 0} lançamento(s) gerado(s).`);
        // Página é force-dynamic — next fetch revalida
        window.location.reload();
        return;
      }
      toast.error(`Ação "${action}" não implementada.`);
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-block mt-2 text-[11.5px] font-mono uppercase tracking-[0.08em] text-olive-700 dark:text-olive-500 hover:text-olive-900 dark:hover:text-olive-300 underline disabled:opacity-50 disabled:cursor-wait"
    >
      {pending ? "Aplicando…" : `→ ${label}`}
    </button>
  );
}
