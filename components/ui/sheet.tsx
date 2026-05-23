"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-ink-950/30 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "right" | "left";
  }
>(({ className, children, side = "right", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile: bottom-sheet com max-height 92vh + drag handle.
        // Desktop (sm+): side panel clássico (direita ou esquerda).
        "fixed z-50 bg-surface border-border shadow-xl outline-none overflow-y-auto",
        // Mobile
        "inset-x-0 bottom-0 max-h-[92vh] rounded-t-[var(--radius-xl)] border-t border-x-0 border-b-0",
        "p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
        "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200",
        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-150",
        // Desktop: vira side panel
        "sm:inset-x-auto sm:bottom-auto sm:top-0 sm:h-full sm:w-[min(520px,100vw)]",
        "sm:rounded-none sm:p-10 sm:border-t-0",
        side === "right"
          ? "sm:right-0 sm:border-l sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right"
          : "sm:left-0 sm:border-r sm:data-[state=open]:slide-in-from-left sm:data-[state=closed]:slide-out-to-left",
        className,
      )}
      {...props}
    >
      {/* Drag handle (só mobile) */}
      <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute top-3 right-3 sm:top-4 sm:right-4 rounded-[6px] p-2 sm:p-1.5 text-faint-foreground",
          "hover:text-foreground hover:bg-surface-muted transition-colors",
        )}
        aria-label="Fechar"
      >
        <X className="w-4 h-4" strokeWidth={1.7} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-7", className)}>
      {eyebrow ? (
        <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint-foreground mb-1.5 font-medium">
          {eyebrow}
        </div>
      ) : null}
      <DialogPrimitive.Title className="font-display text-[26px] sm:text-[28px] tracking-[-0.025em] font-normal text-foreground leading-tight">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-[13.5px] text-muted-foreground mt-2 leading-relaxed">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}
