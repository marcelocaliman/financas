import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: ReactNode;
  description: ReactNode;
  phase: string;
}) {
  return (
    <Panel className="!py-14 !px-10 grid place-items-center text-center">
      <div className="max-w-[460px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          {phase}
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2 text-foreground">
          {title}
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          {description}
        </p>
      </div>
    </Panel>
  );
}
