import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, X, Share } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

const DISMISS_KEY = "nf-install-dismissed";
const RESHOW_DAYS = 21;

function dismissedRecently(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = Number(v);
    return Number.isFinite(ts) && Date.now() - ts < RESHOW_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Banner discreto "instale no celular": só aparece se dá pra instalar (Android/desktop) ou
 * no iOS (com instruções), e some quando já está instalado (standalone) ou foi dispensado.
 * Fica acima do menu inferior no mobile; dispensar é lembrado por ~3 semanas.
 */
export function InstallBanner() {
  const { t } = useTranslation();
  const { canInstall, iosHint, standalone, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(dismissedRecently);
  const [showSteps, setShowSteps] = useState(false);

  if (standalone || dismissed || (!canInstall && !iosHint)) return null;

  const iosOnly = iosHint && !canInstall;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const onAction = async () => {
    if (iosOnly) {
      setShowSteps((s) => !s);
      return;
    }
    const outcome = await install();
    if (outcome === "accepted") setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 z-[70] flex justify-center px-4 pointer-events-none bottom-[calc(70px+env(safe-area-inset-bottom,0px))] lg:bottom-6">
      <div className="pointer-events-auto w-full max-w-md rounded-[16px] border border-border-strong bg-card shadow-[var(--shadow-float)] p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-[12px] bg-accent-soft text-accent shrink-0">
            <Download size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold leading-tight">{t("install.title")}</div>
            <div className="text-[12px] text-muted leading-snug mt-0.5">{t("install.desc")}</div>
          </div>
          <button
            type="button"
            onClick={onAction}
            aria-expanded={iosOnly ? showSteps : undefined}
            className="shrink-0 h-9 px-3.5 rounded-[10px] bg-accent text-[#07140d] text-[13px] font-semibold inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {iosOnly ? t("install.iosHow") : t("install.cta")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("install.dismiss")}
            className="shrink-0 grid place-items-center w-8 h-8 rounded-[9px] text-faint hover:text-text hover:bg-card-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {iosOnly && showSteps ? (
          <div className="mt-2.5 pt-2.5 border-t border-border text-[12.5px] text-muted leading-relaxed flex items-start gap-2">
            <Share size={15} className="mt-0.5 shrink-0 text-accent" />
            <span>{t("install.iosSteps")}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
