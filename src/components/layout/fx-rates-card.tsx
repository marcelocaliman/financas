import { useTranslation } from "react-i18next";
import { ArrowRightLeft } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { isStale } from "@/money/rates";
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
  const source = useRates((s) => s.source);
  const status = useRates((s) => s.status);
  const updatedAt = useRates((s) => s.updatedAt);
  const colors = currencyColors(theme);

  // Silêncio quando está tudo certo (live + fresca): sem ruído. Só AVISA quando a cotação
  // não é mais confiável — nunca conseguiu buscar (default), erro persistente, ou +12h velha.
  // Antes esse card mostrava a taxa DEFAULT hard-coded como se fosse do dia, sem sinal nenhum.
  const stale = source === "default" || status === "error" || isStale(updatedAt, Date.now());

  const rows = CURRENCIES.filter((c) => c !== base).map((c) => ({
    cur: c,
    rate: formatMoney(convert(1, c, base, rates), base, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
  }));

  return (
    <div className="rounded-[14px] bg-card2 border border-border px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <ArrowRightLeft size={11} className="text-faint shrink-0" />
        <Eyebrow>{t("dashboard.fxRates")}</Eyebrow>
        <div className="ml-auto flex items-center gap-2">
          {source === "manual" ? (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">{t("dashboard.fxManual")}</span>
          ) : stale ? (
            <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-neg">
              <span className="w-[5px] h-[5px] rounded-full bg-neg shrink-0" />
              {t("dashboard.fxStale")}
            </span>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{base}</span>
        </div>
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
