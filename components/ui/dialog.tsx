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
        "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        "w-[min(560px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-auto",
        "rounded-[var(--radius-lg)] bg-surface border border-border shadow-xl",
        "p-7 sm:p-8 outline-none",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className,
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close
          className={cn(
            "absolute top-4 right-4 rounded-[6px] p-1.5 text-faint-foreground",
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
