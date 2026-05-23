"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = React.forwardRef<
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
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
  }
>(({ className, children, showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile: bottom-sheet (slide-up, fixo no fundo, full width, max-height 92vh).
        // Desktop (sm+): dialog centralizado clássico.
        "fixed z-50 bg-surface border border-border shadow-xl outline-none overflow-auto",
        // Mobile defaults
        "inset-x-0 bottom-0 max-h-[92vh] rounded-t-[var(--radius-xl)] border-x-0 border-b-0",
        "p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
        "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200",
        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-150",
        // Desktop overrides
        "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
        "sm:w-[min(560px,calc(100vw-32px))] sm:max-h-[calc(100vh-32px)]",
        "sm:rounded-[var(--radius-lg)] sm:border sm:p-8 sm:pb-8",
        "sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:fade-in-0",
        "sm:data-[state=closed]:zoom-out-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    >
      {/* Drag handle (só mobile) */}
      <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
      {children}
      {showClose ? (
        <DialogPrimitive.Close
          className={cn(
            "absolute top-3 right-3 sm:top-4 sm:right-4 rounded-[6px] p-2 sm:p-1.5 text-faint-foreground",
            "hover:text-foreground hover:bg-surface-muted transition-colors",
          )}
          aria-label="Fechar"
        >
          <X className="w-4 h-4" strokeWidth={1.7} />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({
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
    <div className={cn("mb-6", className)}>
      {eyebrow ? (
        <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint-foreground mb-1.5 font-medium">
          {eyebrow}
        </div>
      ) : null}
      <DialogPrimitive.Title className="font-display text-[24px] sm:text-[26px] tracking-[-0.025em] font-normal text-foreground leading-tight">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}

export function DialogFooter({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex justify-end gap-2 mt-7 pt-5 border-t border-border", className)}>
      {children}
    </div>
  );
}
