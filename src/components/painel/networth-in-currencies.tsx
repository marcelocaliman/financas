import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { convert, CURRENCIES } from "@/money/currency";
import { Money } from "@/components/common/money";

/**
 * O MESMO patrimônio líquido expresso nas OUTRAS moedas principais (≈, conversão pela taxa do dia)
 * — "quanto eu valho em euro/dólar/libra". Bloco organizado à direita do número-herói: cada moeda
 * em coluna (código + valor), lado a lado. Valor financeiro → respeita o modo privado.
 */
export function NetWorthInCurrencies({ netWorth }: { netWorth: number }) {
  const { t } = useTranslation();
  const display = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);

  // Todas as moedas principais, exceto a de exibição (que já é o número grande), em ordem estável.
  const others = CURRENCIES.filter((c) => c !== display);
  if (others.length === 0) return null;

  return (
    // Mobile: bloco de largura CHEIA, separado por um hairline, com as moedas distribuídas em 3
    // colunas fixas (grid) → não reflui ao ocultar os números. Desktop (sm:+): igual ao original.
    <div className="flex w-full flex-col items-start gap-2.5 border-t border-border pt-4 sm:w-auto sm:gap-3 sm:border-t-0 sm:pt-0 lg:items-end">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{t("dashboard.alsoWorth")}</span>
      <div className="grid w-full grid-cols-3 gap-x-4 gap-y-3 sm:flex sm:w-auto sm:flex-wrap sm:gap-x-7 lg:justify-end">
        {others.map((c) => (
          <div key={c} className="min-w-0">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint mb-1">{c}</div>
            <Money
              value={convert(netWorth, display, c, rates)}
              currency={c}
              className="text-[17px] font-semibold tracking-[-0.01em] text-muted"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
