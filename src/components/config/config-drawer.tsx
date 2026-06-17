import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUI } from "@/store/ui";
import { pushModal, popModal, isTopModal } from "@/lib/modal-stack";
import { useFocusTrap } from "@/components/common/use-focus-trap";
import { cn } from "@/lib/utils";
import Config from "@/pages/config";

/**
 * Configurações em TELA CHEIA (não um modal flutuante) — coerente com a UI full-bleed do
 * app. Entrada elegante: o fundo aparece em fade e o conteúdo sobe um toque (rise). Fecha
 * no X ou no Esc; trava o foco e o scroll do fundo enquanto aberto.
 */
export function ConfigDrawer() {
  const open = useUI((s) => s.configOpen);
  const setOpen = useUI((s) => s.setConfigOpen);
  const onClose = () => setOpen(false);
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), 320);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurações"
      className={cn(
        "fixed inset-0 z-[60] bg-bg transition-opacity duration-300 motion-reduce:transition-none",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "h-full outline-none transition-[transform,opacity] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <Config onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
