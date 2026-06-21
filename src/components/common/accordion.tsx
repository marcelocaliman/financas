import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useSections } from "@/store/sections";
import { scrollToSection } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";

/**
 * Seção em accordion: título grande + KPIs ao lado (sempre visíveis), detalhes dentro.
 * Expand/colapso suave (grid-rows 0fr→1fr + fade). Estado no store useSections, com
 * fallback `defaultOpen`. A âncora (id) fica no header, que não se move ao expandir.
 */
export function Accordion({
  id,
  title,
  summary,
  defaultOpen = false,
  bare = false,
  exclusive = false,
  children,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Sem a borda-divisória do topo (ex.: quando a seção vive dentro de um card próprio). */
  bare?: boolean;
  /** "Aba única": ao abrir, as OUTRAS fecham. Aqui isso muda a ANIMAÇÃO: a seção que fecha
   *  colapsa INSTANTÂNEA (sem alvo móvel) e compensamos o scroll, pra não "pular". */
  exclusive?: boolean;
  children: ReactNode;
}) {
  const stored = useSections((s) => s.open[id]);
  const setOpen = useSections((s) => s.setOpen);
  const open = stored ?? defaultOpen;

  // Reflete o `defaultOpen` no STORE na 1ª montagem (senão a nav a vê como "fechada").
  useEffect(() => {
    if (defaultOpen && useSections.getState().open[id] === undefined) setOpen(id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `mounted`: corpo (pesado) só entra no DOM ao abrir pela 1ª vez e fica montado.
  // `anim`: dispara a grid 0fr→1fr UM frame DEPOIS do corpo montar, pra a 1ª ABERTURA animar.
  // `expanded = open && anim`: FECHAR colapsa no MESMO render (sem esperar efeito) — essencial
  // pro modo exclusivo, onde a outra seção precisa sumir na hora pra a compensação de scroll
  // medir a posição final certa.
  const [mounted, setMounted] = useState(open);
  const [anim, setAnim] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setAnim(true));
      return () => cancelAnimationFrame(raf);
    }
    setAnim(false);
  }, [open]);
  const expanded = open && anim;

  // No modo exclusivo, a seção que FECHA não anima (colapsa instantâneo); a que abre sempre anima.
  const animateBody = !exclusive || open;

  const onToggle = () => {
    if (open) {
      setOpen(id, false); // fechar a própria: comportamento normal
      return;
    }
    // Abrir (aba única): mede o topo do header AGORA, e com flushSync força o React a APLICAR já
    // o fechamento das outras (instantâneo, sem transição). Aí o getBoundingClientRect já reflete
    // a posição FINAL → compensamos o scroll pra o header não pular, e só então rolamos suave ao
    // topo. Sem o flushSync, a medição saía no estado antigo e o item "subia, saía e voltava".
    const before = document.getElementById(id)?.getBoundingClientRect().top ?? 0;
    flushSync(() => setOpen(id, true));
    const el = document.getElementById(id);
    if (el) {
      const delta = el.getBoundingClientRect().top - before;
      if (delta) {
        const html = document.documentElement;
        const prev = html.style.scrollBehavior;
        html.style.scrollBehavior = "auto"; // compensação é instantânea (ignora smooth global)
        window.scrollBy(0, delta);
        html.style.scrollBehavior = prev;
      }
    }
    scrollToSection(id);
  };

  return (
    <section id={id} className={cn("scroll-mt-24", !bare && "border-t border-border")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="group w-full flex items-center justify-between gap-4 py-7 lg:py-8 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[12px]"
      >
        <h2 id={`${id}-title`} className="font-semibold text-[clamp(22px,3vw,34px)] tracking-[-0.03em] leading-none truncate min-w-0">
          {title}
        </h2>
        <div className="flex items-center gap-5 sm:gap-7 lg:gap-9 shrink-0">
          {summary}
          <span
            className={cn(
              "grid place-items-center w-9 h-9 rounded-full border border-border text-muted transition-all duration-300 motion-reduce:transition-none group-hover:text-text group-hover:border-border-strong",
              open && "rotate-180",
            )}
          >
            <ChevronDown size={18} />
          </span>
        </div>
      </button>

      <div
        id={`${id}-body`}
        role="region"
        aria-labelledby={`${id}-title`}
        className={cn(
          "grid motion-reduce:transition-none",
          animateBody && "transition-all duration-300 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-10 lg:pb-14">{mounted ? children : null}</div>
        </div>
      </div>
    </section>
  );
}
