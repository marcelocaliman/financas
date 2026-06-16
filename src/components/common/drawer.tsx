import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pushModal, popModal, isTopModal } from "@/lib/modal-stack";

/**
 * Drawer/bottom-sheet: sobe de baixo pra cima com fundo desfocado (blur). Fecha no
 * backdrop, no X ou no Esc. Anima entrada/saída e desmonta depois da transição.
 */
export function Drawer({
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
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = pushModal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopModal(id)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      popModal(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={cn(
          "absolute inset-0 bg-black/55 backdrop-blur-md transition-opacity duration-300",
          show ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto w-full max-w-[1120px] flex flex-col",
          "bg-bg border-t border-x border-border rounded-t-[22px] shadow-[var(--shadow-float)]",
          "h-[95vh] transition-transform duration-300 ease-out",
          show ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Pega (grabber) + header */}
        <div className="shrink-0">
          <div className="flex justify-center pt-2.5">
            <div className="w-9 h-1 rounded-full bg-border-strong" />
          </div>
          <div className="flex items-center justify-between px-5 md:px-8 py-3.5 border-b border-border">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-8 py-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
