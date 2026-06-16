import { useEffect } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useHistorico } from "@/hooks/use-historico";
import { useRates } from "@/store/rates";
import { actions } from "@/data/actions";
import { convert } from "@/money/currency";

/** Mês atual em "AAAA-MM" (ordenável). */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Histórico automático: captura/atualiza UM snapshot do mês corrente com o patrimônio
 * líquido atual (em BRL, base estável). Enquanto o mês corre ele se atualiza sozinho;
 * meses passados ficam congelados. Se o usuário editar a linha (vira `auto: false`),
 * o automático para de mexer nela. Não roda em app vazio.
 */
export function useAutoSnapshot(): void {
  const data = usePatrimonio();
  const snapshots = useHistorico();
  const rates = useRates((s) => s.rates);

  useEffect(() => {
    if (!data || !snapshots) return;
    if (data.assets.length === 0 && data.liabilities.length === 0) return;

    const month = currentMonth();
    const nwBRL =
      data.assets.reduce((s, a) => s + convert(a.amount, a.currency, "BRL", rates), 0) -
      data.liabilities.reduce((s, l) => s + convert(l.amount, l.currency, "BRL", rates), 0);

    const existing = snapshots.find((s) => s.month === month);
    if (!existing) {
      void actions.putSnapshot({ id: crypto.randomUUID(), month, currency: "BRL", amount: nwBRL, auto: true });
    } else if (existing.auto && Math.abs(existing.amount - nwBRL) > 0.5) {
      // Só o snapshot AUTO do mês corrente é atualizado; manual/passado fica intocado.
      void actions.putSnapshot({ ...existing, currency: "BRL", amount: nwBRL });
    }
  }, [data, snapshots, rates]);
}
