import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, Globe } from "lucide-react";
import { SUPPORTED_LANGS } from "@/i18n";
import { cn } from "@/lib/utils";

const LANG_LABEL: Record<string, string> = { pt: "Português", en: "English", it: "Italiano" };

/**
 * Seletor de idioma (PT/EN/IT). Troca o idioma do i18next na hora. `onChange` opcional
 * permite a quem usa (ex.: o viewer) persistir a escolha à parte.
 */
export function LanguageMenu({
  dropUp = false,
  alignLeft = false,
  onChange,
}: { dropUp?: boolean; alignLeft?: boolean; onChange?: (lng: string) => void } = {}) {
  const { i18n } = useTranslation();
  const cur = (i18n.resolvedLanguage ?? "pt").slice(0, 2);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (l: string) => {
    void i18n.changeLanguage(l);
    onChange?.(l);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Idioma"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-[10px] border bg-card2 border-border text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <Globe size={14} className="text-faint" />
        <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-text">{cur}</span>
        <ChevronDown size={14} className="text-faint" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute w-44 z-50 rounded-[12px] border border-border bg-card shadow-[var(--shadow-float)] overflow-hidden p-1.5",
              dropUp ? "bottom-full mb-2" : "mt-2",
              alignLeft ? "left-0" : "right-0",
            )}
          >
            {SUPPORTED_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => pick(l)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[8px] transition-colors",
                  l === cur ? "text-accent bg-accent-soft" : "text-muted hover:text-text hover:bg-card-hover",
                )}
              >
                <span className="text-[13.5px]">{LANG_LABEL[l] ?? l}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-faint">{l}</span>
                  {l === cur ? <Check size={14} className="text-accent shrink-0" /> : null}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
