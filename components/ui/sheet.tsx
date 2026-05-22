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
        "fixed top-0 z-50 h-full w-[min(520px,100vw)] bg-surface border-border overflow-y-auto",
        "p-8 sm:p-10 shadow-xl outline-none",
        side === "right"
          ? "right-0 border-l data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
          : "left-0 border-r data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute top-4 right-4 rounded-[6px] p-1.5 text-faint-foreground",
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
