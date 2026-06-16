import { useEffect } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useHistorico } from "@/hooks/use-historico";
import { useRates } from "@/store/rates";
import { useUI } from "@/store/ui";
import { actions } from "@/data/actions";
import { convert } from "@/money/currency";

/** Mês atual em "AAAA-MM" no horário LOCAL (UTC erraria a virada num app cross-border). */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Histórico automático: captura/atualiza UM snapshot do mês corrente com o patrimônio
 * líquido atual, na MOEDA PRINCIPAL do usuário (mesma âncora dos lançamentos), pra a
 * série não misturar moedas. Enquanto o mês corre ele se atualiza sozinho; meses
 * passados ficam congelados. Se o usuário editar a linha (vira `auto: false`), o
 * automático para de mexer nela. Não roda em app vazio.
 */
export function useAutoSnapshot(): void {
  const data = usePatrimonio();
  const snapshots = useHistorico();
  const rates = useRates((s) => s.rates);
  const base = useUI((s) => s.baseCurrency);

  useEffect(() => {
    if (!data || !snapshots) return;
    if (data.assets.length === 0 && data.liabilities.length === 0) return;

    const month = currentMonth();
    const nw =
      data.assets.reduce((s, a) => s + convert(a.amount, a.currency, base, rates), 0) -
      data.liabilities.reduce((s, l) => s + convert(l.amount, l.currency, base, rates), 0);

    const rows = snapshots.filter((s) => s.month === month);
    const manual = rows.find((s) => s.auto !== true);
    if (manual) {
      // Usuário assumiu o mês manualmente → respeita e limpa um auto duplicado, se houver.
      const dupAuto = rows.find((s) => s.auto === true);
      if (dupAuto) void actions.removeSnapshot(dupAuto.id);
      return;
    }
    const auto = rows.find((s) => s.auto === true);
    if (!auto) {
      void actions.putSnapshot({ id: crypto.randomUUID(), month, currency: base, amount: nw, auto: true });
    } else if (auto.currency !== base || Math.abs(auto.amount - nw) > 0.5) {
      // Mantém o snapshot AUTO do mês corrente alinhado ao patrimônio E à moeda principal.
      void actions.putSnapshot({ ...auto, currency: base, amount: nw });
    }
  }, [data, snapshots, rates, base]);
}
