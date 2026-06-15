import { useTranslation } from "react-i18next";
import { CurrencyToggle } from "./currency-toggle";
import { convert, formatMoney } from "@/money/currency";

/** Barra superior: título da seção + câmbio de referência + switch de moeda. */
export function TopBar({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { t } = useTranslation();
  const eurInBrl = convert(1, "EUR", "BRL");

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 md:px-8 py-4 glass border-b border-border">
      <div className="min-w-0">
        <div className="text-[11px] text-faint font-semibold tracking-[0.08em] uppercase">
          {eyebrow}
        </div>
        <div className="text-[18px] font-bold font-display tracking-[-0.02em] truncate">{title}</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right text-[11px] text-faint leading-tight">
          <div>{t("common.exchangeRate")}</div>
          <div className="text-muted font-semibold tabular">
            1 € = {formatMoney(eurInBrl, "BRL", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <CurrencyToggle />
      </div>
    </header>
  );
}
