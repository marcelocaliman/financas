import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { useUI } from "@/store/ui";
import Suporte, { SuporteSummary } from "@/pages/suporte";

/**
 * Ajuda & Suporte em TELA CHEIA — página própria (igual ao painel admin substitui o app).
 * Aberta pelo item do rodapé do menu; "Voltar ao app" / ESC fecham. Fora da rolagem do
 * dashboard, que volta a ser 100% gestão de patrimônio.
 */
export function SupportApp() {
  const { t } = useTranslation();
  const setSupportOpen = useUI((s) => s.setSupportOpen);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSupportOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setSupportOpen]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-[960px] mx-auto px-5 md:px-8 h-[60px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
              <LifeBuoy size={16} strokeWidth={2.4} />
            </span>
            <span className="font-semibold text-[15.5px] tracking-[-0.02em] truncate">{t("nav.suporte")}</span>
          </div>
          <button
            type="button"
            onClick={() => setSupportOpen(false)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] border border-border text-[12.5px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ArrowLeft size={15} /> {t("menu.back")}
          </button>
        </div>
      </header>

      <main className="max-w-[960px] mx-auto px-5 md:px-8 py-8 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <h1 className="text-[clamp(1.9rem,4vw,2.7rem)] font-semibold tracking-[-0.035em] leading-tight">
            {t("nav.suporte")}
          </h1>
          <SuporteSummary />
        </div>
        <Suporte />
      </main>
    </div>
  );
}
