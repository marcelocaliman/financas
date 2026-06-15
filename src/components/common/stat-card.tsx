import { Panel } from "./panel";
import { cn } from "@/lib/utils";

/** Card de número (Ativos, Investido, Receitas…). */
export function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <Panel className="p-4">
      <div className="text-[12px] text-muted font-medium">{label}</div>
      <div
        className={cn(
          "text-[20px] font-bold tracking-[-0.01em] mt-1 tabular-nums",
          positive ? "text-pos" : "text-navy dark:text-text",
        )}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] text-faint mt-0.5">{sub}</div> : null}
    </Panel>
  );
}
