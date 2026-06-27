import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip leve via PORTAL — não é cortado pelo `overflow-hidden` do container (ex.: a sidebar
 * recolhida). Aparece à DIREITA do gatilho (ideal pro menu lateral só-ícones) após um pequeno
 * atraso, e some na hora. Hover + foco por teclado. O wrapper é um flex que envolve 1 filho
 * (tamanho do próprio filho), então não atrapalha o layout. Substitui o `title=` nativo (lento
 * e sem estilo). Mede no momento de exibir, então respeita rolagem do menu.
 */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ top: r.top + r.height / 2, left: r.right + 10 });
    }, 110);
  };
  const hide = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setPos(null);
  };

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocusCapture={show} onBlurCapture={hide} className="flex">
      {children}
      {pos
        ? createPortal(
            <div
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[60] -translate-y-1/2 pointer-events-none rounded-[8px] border border-border-strong bg-card px-2.5 py-1.5 text-[12px] font-medium text-text shadow-[var(--shadow-float)] whitespace-nowrap"
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
