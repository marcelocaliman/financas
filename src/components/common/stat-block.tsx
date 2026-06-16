import type { ReactNode } from "react";
import { Eyebrow } from "./tile";
import { cn } from "@/lib/utils";

type Tone = "text" | "neg" | "pos" | "accent";

/** Bloco de número-resumo: eyebrow mono + valor grande tabular. */
export function StatBlock({
  label,
  tone = "text",
  children,
}: {
  label: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "font-numeric font-semibold tabular tracking-[-0.02em] text-[clamp(20px,2.3vw,28px)] mt-1.5",
          tone === "neg" ? "text-neg" : tone === "pos" ? "text-pos" : tone === "accent" ? "text-accent" : "text-text",
        )}
      >
        {children}
      </div>
    </div>
  );
}
