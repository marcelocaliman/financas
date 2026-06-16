import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useSections } from "@/store/sections";
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
  children,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const stored = useSections((s) => s.open[id]);
  const setOpen = useSections((s) => s.setOpen);
  const open = stored ?? defaultOpen;

  // Só monta os detalhes (pesados: tabelas/gráficos) ao abrir pela 1ª vez; depois
  // permanecem montados pra a animação de colapsar/expandir continuar suave.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  return (
    <section id={id} className="scroll-mt-24 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(id, !open)}
        aria-expanded={open}
        className="group w-full flex items-center justify-between gap-4 py-7 lg:py-8 text-left"
      >
        <h2 className="font-semibold text-[clamp(22px,3vw,34px)] tracking-[-0.03em] leading-none truncate min-w-0">
          {title}
        </h2>
        <div className="flex items-center gap-5 sm:gap-7 lg:gap-9 shrink-0">
          {summary}
          <span
            className={cn(
              "grid place-items-center w-9 h-9 rounded-full border border-border text-muted transition-all duration-300 group-hover:text-text group-hover:border-border-strong",
              open && "rotate-180",
            )}
          >
            <ChevronDown size={18} />
          </span>
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-10 lg:pb-14">{mounted ? children : null}</div>
        </div>
      </div>
    </section>
  );
}
