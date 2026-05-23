import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[8px] text-[13px] font-medium tracking-[-0.005em]",
    "transition-[transform,background-color,border-color,color,box-shadow] duration-150",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-ink-950 text-white border border-ink-950 hover:bg-ink-800 hover:border-ink-800 hover:-translate-y-px",
        secondary:
          "bg-surface text-foreground border border-border-strong hover:border-navy-500 hover:-translate-y-px",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
        danger:
          "bg-rust-700 text-white border border-rust-700 hover:bg-rust-800 hover:border-rust-800",
        outline:
          "bg-transparent text-foreground border border-border-strong hover:bg-surface-muted",
      },
      size: {
        // Mobile bumps a tier pra touch (≥40px). Desktop mantém compacto.
        sm: "h-9 sm:h-8 px-3 text-[12.5px] sm:text-[12px]",
        md: "h-10 sm:h-9 px-4 sm:px-3.5",
        lg: "h-11 px-5 text-[14px]",
        icon: "h-10 w-10 sm:h-9 sm:w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
