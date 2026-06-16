import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pushModal, popModal, isTopModal } from "@/lib/modal-stack";
import { useFocusTrap } from "./use-focus-trap";

/** Modal central com sobreposição (mesma linguagem da política de privacidade). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useEffect(() => {
    if (!open) return;
    const id = pushModal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopModal(id)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Captura/restaura o valor anterior — se este Dialog abre DENTRO do Drawer (que já
    // travou o scroll), ao fechar mantém o "hidden" do Drawer em vez de destravar atrás.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      popModal(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
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
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "w-full rounded-2xl bg-card border border-border shadow-card p-6 my-auto outline-none",
          wide ? "max-w-lg" : "max-w-sm",
        )}
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
