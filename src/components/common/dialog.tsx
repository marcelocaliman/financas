import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { pushModal, popModal, isTopModal } from "@/lib/modal-stack";

/** Modal central com sobreposição (mesma linguagem da política de privacidade). */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const id = pushModal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopModal(id)) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      popModal(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portado pro body: escapa de qualquer ancestral com transform (ex.: o painel de
  // Config), pra centrar na JANELA e o backdrop cobrir tudo. z acima do drawer (60).
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto px-4 py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-card p-6 my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <h2 className="text-[16px] font-bold tracking-[-0.01em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-muted hover:text-text shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
