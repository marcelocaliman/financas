import Link from "next/link";
import { CheckCircle2, AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";
import type { ChecklistReport } from "@/services/ir/checklist";
import { cn } from "@/lib/utils/cn";

export function ChecklistPanel({ report }: { report: ChecklistReport }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1">
            Pronto pra declarar?
          </div>
          <h3 className="text-[16px] font-medium text-foreground">
            {report.readyToExport ? "Sim, pode exportar." : "Ainda não — itens críticos pendentes."}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[12px] font-mono">
          {report.counts.error > 0 ? (
            <span className="text-rust-600 font-medium">
              {report.counts.error} erro{report.counts.error === 1 ? "" : "s"}
            </span>
          ) : null}
          {report.counts.warning > 0 ? (
            <span className="text-gold-700 dark:text-gold-200">
              {report.counts.warning} aviso{report.counts.warning === 1 ? "" : "s"}
            </span>
          ) : null}
          {report.readyToExport ? (
            <span className="text-olive-700 dark:text-olive-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.7} />
              OK
            </span>
          ) : null}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {report.items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistReport["items"][number] }) {
  const Icon =
    item.severity === "error"
      ? AlertCircle
      : item.severity === "warning"
        ? AlertTriangle
        : CheckCircle2;

  const iconColor =
    item.severity === "error"
      ? "text-rust-600"
      : item.severity === "warning"
        ? "text-gold-700 dark:text-gold-200"
        : "text-olive-700 dark:text-olive-200";

  return (
    <li className="px-5 py-3 flex items-start gap-3">
      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", iconColor)} strokeWidth={1.7} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-foreground">{item.title}</div>
        {item.detail ? (
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
        ) : null}
      </div>
      {item.link ? (
        <Link
          href={item.link.href}
          className="inline-flex items-center gap-1 text-[12px] text-navy-700 dark:text-navy-300 hover:underline flex-shrink-0"
        >
          {item.link.label}
          <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
        </Link>
      ) : null}
    </li>
  );
}
