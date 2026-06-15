import { useTranslation } from "react-i18next";
import { CurrencyToggle } from "./currency-toggle";
import { convert, formatMoney } from "@/money/currency";

/** Barra superior: título da seção + câmbio de referência + switch R$/€. */
export function TopBar({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { t } = useTranslation();
  const eurInBrl = convert(1, "EUR", "BRL"); // referência 1 € = R$ X

  return (
    <header className="flex items-center justify-between px-5 md:px-8 py-5 border-b border-border bg-card">
      <div className="min-w-0">
        <div className="text-[12px] text-faint font-semibold tracking-[0.04em] uppercase">
          {eyebrow}
        </div>
        <div className="text-[18px] font-bold tracking-[-0.01em] truncate">{title}</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right text-[11px] text-faint leading-tight">
          <div>{t("common.exchangeRate")}</div>
          <div className="text-muted font-semibold tabular-nums">
            1 € = {formatMoney(eurInBrl, "BRL", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <CurrencyToggle />
      </div>
    </header>
  );
}
