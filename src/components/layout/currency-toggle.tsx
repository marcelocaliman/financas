import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { CURRENCIES, CURRENCY_SYMBOL } from "@/money/currency";

/** Moeda de exibição como dropdown — mostra só a selecionada; abre a lista pra trocar. */
export function CurrencyMenu() {
  const cur = useUI((s) => s.displayCurrency);
  const setCur = useUI((s) => s.setDisplayCurrency);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Moeda de exibição"
        className="flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-[10px] bg-card2 border border-border text-muted hover:text-text hover:bg-card-hover transition-colors"
      >
        <span className="text-[13px] font-semibold tabular text-text">{CURRENCY_SYMBOL[cur]}</span>
        <span className="text-[11px] text-faint font-medium hidden sm:inline">{cur}</span>
        <ChevronDown size={14} className="text-faint" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-40 z-50 rounded-[12px] border border-border bg-card shadow-[var(--shadow-float)] overflow-hidden p-1.5">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCur(c);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[8px] transition-colors",
                  c === cur ? "text-text bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-8 text-[13px] font-semibold tabular text-left">{CURRENCY_SYMBOL[c]}</span>
                  <span className="text-[12px] text-faint">{c}</span>
                </span>
                {c === cur ? <Check size={14} className="text-accent" /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
