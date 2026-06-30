import { useTranslation } from "react-i18next";
import { ArrowRightLeft } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { convert, formatMoney, CURRENCIES } from "@/money/currency";
import { currencyColors } from "@/money/composition";
import { Eyebrow } from "@/components/common/tile";

/**
 * Cotação das principais moedas contra a MOEDA PRINCIPAL do usuário (base), LADO A LADO.
 * Taxa efetiva em uso no app (useRates) — dado público de mercado, não esconde no modo privado.
 */
export function FxRatesCard() {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const colors = currencyColors(theme);

  const rows = CURRENCIES.filter((c) => c !== base).map((c) => ({
    cur: c,
    rate: formatMoney(convert(1, c, base, rates), base, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
  }));

  return (
    <div className="rounded-[14px] bg-card2 border border-border px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <ArrowRightLeft size={11} className="text-faint shrink-0" />
        <Eyebrow>{t("dashboard.fxRates")}</Eyebrow>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{base}</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {rows.map((r) => (
          <div key={r.cur} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-[6px] h-[6px] rounded-[2px] shrink-0" style={{ background: colors[r.cur] }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">{r.cur}</span>
            </div>
            <div className="tabular font-semibold text-[13px] mt-1 truncate" title={r.rate}>
              {r.rate}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
