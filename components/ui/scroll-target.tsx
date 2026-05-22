"use client";

import { useEffect, useRef } from "react";

/**
 * Wrapper que escuta o evento `app:focus` (ou outro custom) e, quando o
 * `detail.target` bater com `targetId`, faz scroll suave + flash visual.
 *
 * Use junto com `<KeyboardNav>` pra criar navegação por teclas em qualquer página.
 */
export function ScrollTarget({
  targetId,
  eventName = "app:focus",
  children,
  className,
}: {
  targetId: string;
  eventName?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ target: string }>;
      if (ce.detail?.target !== targetId) return;
      requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        ref.current?.classList.add("ring-2", "ring-navy-700/40");
        setTimeout(() => {
          ref.current?.classList.remove("ring-2", "ring-navy-700/40");
        }, 800);
      });
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [eventName, targetId]);

  return (
    <div ref={ref} className={`rounded-[var(--radius-xl)] transition-shadow ${className ?? ""}`}>
      {children}
    </div>
  );
}
