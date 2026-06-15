import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { CurrencyBadge } from "@/components/common/currency-badge";
import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";
import type { Currency } from "@/money/currency";

/** Linha de um ativo/passivo, com valor convertido + ações (editar/excluir). */
export function ItemRow({
  name,
  typeLabel,
  currency,
  amount,
  displayValue,
  displayCurrency,
  negative,
  onEdit,
  onDelete,
}: {
  name: string;
  typeLabel: string;
  currency: Currency;
  amount: number;
  displayValue: number;
  displayCurrency: Currency;
  negative?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="group flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <CurrencyBadge currency={currency} />
        <div className="min-w-0">
          <div className="text-[14px] truncate">{name}</div>
          <div className="text-[11.5px] text-faint">{typeLabel}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <Money
            value={displayValue}
            currency={displayCurrency}
            className={cn("text-[14px] font-semibold", negative ? "text-neg" : "text-text")}
            options={negative ? { signDisplay: "never" } : undefined}
          />
          {currency !== displayCurrency ? (
            <div className="text-[11px] text-faint">
              <Money value={amount} currency={currency} />
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("common.edit")}
            className="p-1.5 rounded-md text-muted hover:text-teal hover:bg-bg"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("patrimonio.delete")}
            className="p-1.5 rounded-md text-muted hover:text-neg hover:bg-bg"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
