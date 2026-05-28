import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { AssetSnapshot } from "@/services/quotes";

/**
 * Cells da linha de Renda Fixa: saldo atual + variação em R$ e %.
 *
 * Sem compound diário — usa baseBalance direto (current_balance manual).
 * Mantidos os mesmos nomes pra compat com chamadores.
 */

export function LiveSaldoCell({
  asset,
  fallback,
}: {
  asset: AssetSnapshot;
  fallback: number;
}) {
  const saldo = asset.baseBalance > 0 ? asset.baseBalance : fallback;
  return (
    <span className="font-mono text-[13px] font-medium tabular-nums">
      <MoneyMask>{formatMoney(saldo)}</MoneyMask>
    </span>
  );
}

export function LiveVariationCell({
  asset,
  initialAmount,
}: {
  asset: AssetSnapshot;
  initialAmount: number;
}) {
  const saldo = asset.baseBalance;
  const delta = saldo - initialAmount;
  const deltaPct = initialAmount > 0 ? delta / initialAmount : 0;

  if (Math.abs(delta) < 0.005) {
    return <span className="text-faint-foreground font-mono text-[12.5px]">—</span>;
  }

  const tone =
    delta > 0 ? "text-olive-700 dark:text-olive-500" : "text-rust-600";
  const sign = delta > 0 ? "+" : "";

  return (
    <div className="flex flex-col items-end leading-tight">
      <span className={`font-mono text-[12.5px] font-medium ${tone}`}>
        {sign}
        {formatPercent(deltaPct, 2)}
      </span>
      <span className={`font-mono text-[10.5px] ${tone} mt-0.5 tabular-nums`}>
        {sign}
        <MoneyMask>{formatMoney(delta)}</MoneyMask>
      </span>
    </div>
  );
}
