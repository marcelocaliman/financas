import { useTranslation } from "react-i18next";
import { ArrowRightLeft } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useFxHistory } from "@/store/fx-history";
import { convert, formatMoney, CURRENCIES } from "@/money/currency";
import { pairChangePct } from "@/money/fx-daily";
import { currencyColors } from "@/money/composition";
import { Eyebrow } from "@/components/common/tile";
import { cn } from "@/lib/utils";

/**
 * Cotação das principais moedas contra a MOEDA PRINCIPAL do usuário (base), com a variação do
 * dia. Taxa e % vêm da MESMA fonte (fechamento de mercado do Frankfurter) p/ ficarem coerentes;
 * antes do histórico carregar, mostra a taxa efetiva do app como ponte (sem %). O bootstrap do
 * histórico é centralizado no App. Tudo dado público — não esconde no modo privado.
 */
export function FxRatesCard() {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const today = useFxHistory((s) => s.today);
  const prev = useFxHistory((s) => s.prev);
  const colors = currencyColors(theme);

  // Taxa de mercado quando o histórico já carregou; senão, a efetiva do app como ponte.
  const rateTable = today ?? rates;
  const rows = CURRENCIES.filter((c) => c !== base).map((c) => ({
    cur: c,
    rate: convert(1, c, base, rateTable),
    pct: today && prev ? pairChangePct(c, base, today, prev) : null,
  }));

  return (
    <div className="rounded-[14px] bg-card2 border border-border px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <ArrowRightLeft size={11} className="text-faint shrink-0" />
        <Eyebrow>{t("dashboard.fxRates")}</Eyebrow>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{base}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.cur} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: colors[r.cur] }} />
            <span className="font-mono text-muted">{r.cur}</span>
            <span className="ml-auto tabular font-semibold">
              {formatMoney(r.rate, base, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
            <span
              className={cn(
                "tabular text-[11px] w-[54px] text-right",
                r.pct == null ? "text-faint" : r.pct >= 0 ? "text-accent" : "text-neg",
              )}
            >
              {r.pct == null ? "—" : `${r.pct >= 0 ? "↑" : "↓"}${Math.abs(r.pct).toFixed(2)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
