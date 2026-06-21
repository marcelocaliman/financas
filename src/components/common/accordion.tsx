import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

  // Topo do header no instante do clique (aba única). O useLayoutEffect abaixo compensa o scroll
  // já com as outras fechadas — ANTES da pintura, então o header nunca aparece fora da tela.
  const pendingTop = useRef<number | null>(null);

  const onToggle = () => {
    if (open) {
      setOpen(id, false); // fechar a própria: comportamento normal
      return;
    }
    pendingTop.current = document.getElementById(id)?.getBoundingClientRect().top ?? 0;
    setOpen(id, true); // fecha as outras (instantâneo) + abre esta
  };

  // Roda DEPOIS do commit (DOM já com as outras fechadas) e ANTES da pintura: mede onde o header
  // foi parar, devolve ele à posição do clique (scroll instantâneo) e SÓ ENTÃO rola suave ao topo.
  // Como tudo acontece antes de pintar, não há o "sobe, sai da tela, desce e volta".
  useLayoutEffect(() => {
    if (!open || pendingTop.current == null) return;
    const before = pendingTop.current;
    pendingTop.current = null;
    const after = document.getElementById(id)?.getBoundingClientRect().top ?? before;
    const delta = after - before;
    if (delta) window.scrollBy({ top: delta, left: 0, behavior: "instant" as ScrollBehavior });
    scrollToSection(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
