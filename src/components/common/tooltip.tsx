import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Tooltip leve via PORTAL — não é cortado pelo `overflow-hidden` do container (ex.: a sidebar
 * recolhida). Aparece à DIREITA do gatilho após um pequeno atraso e some na hora. Hover + foco.
 *
 * Dois modos:
 *  - `label` (string): balão compacto de texto — o uso clássico (nav só-ícones).
 *  - `content` (ReactNode): balão RICO (mais largo, com padding próprio) — ex.: resumo/vencimentos
 *    num item do menu. Tem precedência sobre `label`. Passivo (pointer-events-none), delay maior
 *    por padrão e clamp vertical pra não vazar da viewport quando o conteúdo é alto.
 * O wrapper é `flex` por padrão; passe `className` (ex.: "w-full") pra envolver um item largo.
 */
export function Tooltip({
  label,
  content,
  delay,
  className,
  children,
}: {
  label?: string;
  content?: ReactNode;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rich = content != null;
  const openDelay = delay ?? (rich ? 300 : 110);

  const show = () => {
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ top: r.top + r.height / 2, left: r.right + 10 });
    }, openDelay);
  };
  const hide = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setPos(null);
  };

  // Centraliza no gatilho, mas trava dentro da viewport (conteúdo alto não vaza no topo/base).
  // Imperativo (sem estado) pra não gerar re-render em loop; roda antes do paint (sem flash).
  useLayoutEffect(() => {
    const node = popRef.current;
    if (!node || !pos) return;
    const h = node.offsetHeight;
    const m = 8;
    node.style.top = `${Math.max(m, Math.min(pos.top - h / 2, window.innerHeight - m - h))}px`;
  }, [pos]);

  if (label == null && !rich) return <>{children}</>;

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocusCapture={show} onBlurCapture={hide} className={cn("flex", className)}>
      {children}
      {pos
        ? createPortal(
            <div
              ref={popRef}
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
              className={cn(
                "fixed z-[60] pointer-events-none border border-border-strong bg-card text-text shadow-[var(--shadow-float)]",
                rich
                  ? "w-[320px] rounded-[14px] overflow-hidden"
                  : "rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap",
              )}
            >
              {rich ? content : label}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
