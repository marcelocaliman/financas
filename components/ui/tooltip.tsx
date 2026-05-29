"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils/cn";

/**
 * Tooltip do design system.
 *
 * Características:
 *   - Delay 150ms (vs 500-1000ms nativo) — sensação ágil
 *   - Fundo escuro de alto contraste em ambos os temas
 *   - Fonte sans 11.5px, padding compacto
 *   - Animação fade-in 100ms
 *   - Arrow apontando pro alvo
 *   - Auto-flip de posição (default acima, vai pra baixo se sem espaço)
 *
 * USO:
 *
 *   <Tooltip content="Apagar">
 *     <button onClick={...}><Trash /></button>
 *   </Tooltip>
 *
 * Ou pra uso avançado (sub-componentes):
 *
 *   <TooltipRoot>
 *     <TooltipTrigger asChild>
 *       <button><Trash /></button>
 *     </TooltipTrigger>
 *     <TooltipContent>Apagar</TooltipContent>
 *   </TooltipRoot>
 *
 * TooltipProvider deve estar no layout root (já configurado em (app)/layout.tsx).
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        "z-[100] inline-flex items-center px-2 py-1 rounded-[5px]",
        "font-medium text-[11.5px] leading-[1.3] tracking-[-0.005em]",
        "bg-ink-950 text-white dark:bg-bone-100 dark:text-ink-950",
        "shadow-md border border-ink-950 dark:border-bone-100",
        "max-w-[260px]",
        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 duration-100",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-75",
        "data-[side=top]:slide-in-from-bottom-1",
        "data-[side=bottom]:slide-in-from-top-1",
        "data-[side=left]:slide-in-from-right-1",
        "data-[side=right]:slide-in-from-left-1",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow
        className="fill-ink-950 dark:fill-bone-100"
        width={8}
        height={4}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * Wrapper conveniente pra caso de uso 90%: tooltip texto simples
 * sobre um botão/elemento. Aceita string OU ReactNode no `content`.
 *
 *   <Tooltip content="Apagar">
 *     <button>...</button>
 *   </Tooltip>
 *
 * Se `content` for null/undefined/"", o tooltip não renderiza (escape hatch
 * pra condicionais sem precisar envolver em ternário).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 150,
  asChild = true,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  asChild?: boolean;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}
