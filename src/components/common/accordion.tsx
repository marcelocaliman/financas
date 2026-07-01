import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useSections } from "@/store/sections";
import { scrollToSection, StickyOffsetContext } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";

/**
 * Seção em accordion: título grande + KPIs ao lado (sempre visíveis), detalhes dentro.
 * Expand/colapso suave (grid-rows 0fr→1fr + fade). Estado no store useSections, com
 * fallback `defaultOpen`. A âncora (id) fica no header, que não se move ao expandir.
 * Várias seções podem ficar abertas ao mesmo tempo (cada uma é independente).
 *
 * Sticky: quando a seção está ABERTA e é mais alta que a tela, o cabeçalho gruda no topo (logo
 * abaixo do ticker/barra) enquanto se rola o conteúdo dela — e ao chegar a próxima seção, o
 * cabeçalho dela empurra este pra cima (sticky empilhado). O offset vem do StickyOffsetContext
 * que a página provê (o Accordion não adivinha o layout). Sem provider (ex.: admin), não gruda.
 */
export function Accordion({
  id,
  title,
  summary,
  defaultOpen = false,
  bare = false,
  children,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Sem a borda-divisória do topo (ex.: quando a seção vive dentro de um card próprio). */
  bare?: boolean;
  children: ReactNode;
}) {
  const stored = useSections((s) => s.open[id]);
  const setOpen = useSections((s) => s.setOpen);
  const open = stored ?? defaultOpen;
  const stickyTop = useContext(StickyOffsetContext);

  // Reflete o `defaultOpen` no STORE na 1ª montagem. Sem isto, a seção aparece aberta (via
  // fallback) mas o store fica `undefined` — e o menu a enxerga como "fechada", então clicar
  // no item não a fecha. Sincronizar deixa a nav e os contadores de "abrir/fechar tudo" verem o
  // estado real. Roda 1× e respeita uma escolha posterior do usuário (aí `stored` deixa de ser undefined).
  useEffect(() => {
    if (defaultOpen && useSections.getState().open[id] === undefined) setOpen(id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `mounted`: corpo (pesado) só entra no DOM ao abrir pela 1ª vez e fica montado.
  // `expanded`: dispara a grid 0fr→1fr UM frame DEPOIS do corpo montar, pra a 1ª
  // abertura animar de verdade (em vez de aparecer de estalo). Colapsar é imediato.
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setExpanded(true));
      return () => cancelAnimationFrame(raf);
    }
    setExpanded(false);
  }, [open]);

  // Cabeçalho grudado só faz sentido com a seção ABERTA (tem conteúdo pra rolar).
  const isSticky = stickyTop != null && open;
  // "stuck": o cabeçalho ATINGIU o topo (gruda) — aí ganha uma sombra-hairline pra separar do
  // conteúdo que passa por baixo. Uma sentinela (0px, acima do header) sai da viewport na linha
  // do offset; o IntersectionObserver com rootMargin negativo detecta exatamente esse momento.
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!isSticky || !el) {
      setStuck(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      rootMargin: `-${stickyTop! + 1}px 0px 0px 0px`,
      threshold: [0],
    });
    io.observe(el);
    return () => io.disconnect();
  }, [isSticky, stickyTop]);

  return (
    <section id={id} className={cn("scroll-mt-24", !bare && "border-t border-border")}>
      {/* Sentinela da detecção "stuck" (altura líquida 0 com -mb-px). */}
      <div ref={sentinelRef} aria-hidden className="h-px -mb-px" />
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(id, next);
          // Ao ABRIR pelo cabeçalho, rola até a seção (mesmo comportamento do menu).
          if (next) requestAnimationFrame(() => scrollToSection(id));
        }}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        style={isSticky ? { top: stickyTop } : undefined}
        className={cn(
          "group w-full flex items-center justify-between gap-4 py-7 lg:py-8 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[12px]",
          // Gruda no topo (abaixo do ticker/barra) e ocluí o conteúdo que rola por baixo (bg-bg).
          isSticky && "sticky z-20 bg-bg transition-shadow duration-200 motion-reduce:transition-none",
          isSticky && stuck && "shadow-[0_1px_0_0_var(--border),0_10px_20px_-18px_rgba(0,0,0,0.55)]",
        )}
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
          "grid transition-all duration-300 ease-out motion-reduce:transition-none",
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
