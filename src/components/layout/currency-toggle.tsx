import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { CURRENCIES, CURRENCY_SYMBOL } from "@/money/currency";

/**
 * Switcher de EXIBIÇÃO. A moeda principal (base) é a âncora; trocar aqui é só uma
 * prévia temporária (volta pra principal ao recarregar). Sinaliza quando você está
 * vendo numa moeda diferente da principal e marca qual é a principal na lista.
 */
export function CurrencyMenu({ dropUp = false, alignLeft = false }: { dropUp?: boolean; alignLeft?: boolean } = {}) {
  const { t } = useTranslation();
  const cur = useUI((s) => s.displayCurrency);
  const setCur = useUI((s) => s.setDisplayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const [open, setOpen] = useState(false);
  const preview = cur !== base;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Moeda de exibição"
        aria-haspopup="true"
        aria-expanded={open}
        title={preview ? t("common.previewHint", { cur: base }) : undefined}
        className={cn(
          "flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-[10px] border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          preview
            ? "bg-accent-soft border-accent/40 text-text"
            : "bg-card2 border-border text-muted hover:text-text hover:bg-card-hover",
        )}
      >
        {preview ? <span className="w-[5px] h-[5px] rounded-full bg-accent shrink-0" /> : null}
        <span className="text-[13px] font-semibold tabular text-text">{CURRENCY_SYMBOL[cur]}</span>
        <span className="text-[11px] text-faint font-medium hidden sm:inline">{cur}</span>
        <ChevronDown size={14} className="text-faint" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute w-52 z-50 rounded-[12px] border border-border bg-card shadow-[var(--shadow-float)] overflow-hidden p-1.5",
              dropUp ? "bottom-full mb-2" : "mt-2",
              alignLeft ? "left-0" : "right-0",
            )}
          >
            <div className="px-2.5 pt-1 pb-1.5 eyebrow text-faint">{t("common.viewIn")}</div>
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
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 text-[13px] font-semibold tabular text-left">{CURRENCY_SYMBOL[c]}</span>
                  <span className="text-[12px] text-faint">{c}</span>
                  {c === base ? (
                    <span className="text-[9.5px] font-mono uppercase tracking-[0.1em] text-accent px-1.5 py-0.5 rounded-full bg-accent-soft">
                      {t("common.mainTag")}
                    </span>
                  ) : null}
                </span>
                {c === cur ? <Check size={14} className="text-accent shrink-0" /> : null}
              </button>
            ))}
            {preview ? (
              <button
                type="button"
                onClick={() => {
                  setCur(base);
                  setOpen(false);
                }}
                className="mt-1 w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] text-accent hover:bg-card-hover transition-colors"
              >
                {t("common.backToMain", { cur: base })}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
