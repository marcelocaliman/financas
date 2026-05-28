import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * Saldo estático de um ativo no FlowDiagram da página /resgates.
 * Antes pulsava com rendimento do dia; sem compound, mostra direto o baseBalance.
 */
export function LiveBalance({
  baseBalance,
  dailyYield,
  perSecond,
}: {
  baseBalance: number;
  dailyYield: number;
  perSecond: number;
}) {
  void dailyYield;
  void perSecond;
  return (
    <span className="font-mono tabular-nums">
      <MoneyMask>{formatMoney(baseBalance)}</MoneyMask>
    </span>
  );
}
