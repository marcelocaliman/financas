"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { recomputeBalances } from "@/services/accounts.actions";

/**
 * Recalcula os saldos de todas as contas a partir dos lançamentos (fonte da
 * verdade). Conserta divergências que importações/edições em massa possam ter
 * deixado no saldo armazenado.
 */
export function RecomputeBalancesButton() {
  const [pending, start] = useTransition();
  return (
    <Tooltip content="Recalcula os saldos a partir dos lançamentos — use se algum saldo parecer errado depois de importar.">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await recomputeBalances();
            if (r.error) toast.error(r.error);
            else toast.success(`Saldos recalculados${r.count ? ` (${r.count} contas)` : ""}.`);
          })
        }
      >
        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${pending ? "animate-spin" : ""}`} strokeWidth={1.7} />
        Recalcular saldos
      </Button>
    </Tooltip>
  );
}
