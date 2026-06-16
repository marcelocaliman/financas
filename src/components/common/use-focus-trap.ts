import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Acessibilidade de modal: ao ABRIR, leva o foco pra dentro do painel e prende o Tab
 * (loop circular). Ao FECHAR, devolve o foco pra quem abriu. Keyed em `open` (o painel
 * pode continuar montado durante a animação de saída). Dá `tabIndex={-1}` + `ref` ao painel.
 */
export function useFocusTrap(panelRef: RefObject<HTMLElement | null>, open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const returnTo = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null,
      );

    // Move o foco pra dentro (1º focável; senão o próprio painel) após o paint.
    const raf = requestAnimationFrame(() => (focusables()[0] ?? panel)?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        panel?.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open, panelRef]);
}
