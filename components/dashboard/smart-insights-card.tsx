import Link from "next/link";
import {
  AlertTriangle,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { Insight } from "@/services/insights";
import { cn } from "@/lib/utils/cn";

/**
 * Card "Achados" no /dashboard — substitui/complementa o InsightCard antigo
 * (que só mostrava anomalias de gasto). Agora cobre 6 dimensões:
 * orçamentos, metas, taxa de poupança, cobertura FIRE, assinaturas, etc.
 *
 * Cada achado tem severity + ação clicável (link). Visual editorial,
 * sem alarmismo.
 */
export function SmartInsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <Panel className="!p-6 mb-6">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
            Achados desta semana
          </span>
        }
        meta={`${insights.length} ${insights.length === 1 ? "observação" : "observações"}`}
      />
      <ul className="space-y-3 -mt-2">
        {insights.map((i) => (
          <InsightRow key={i.id} insight={i} />
        ))}
      </ul>
    </Panel>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  return (
    <li
      className={cn(
        "rounded-[8px] border px-4 py-3 transition-colors",
        insight.severity === "critical"
          ? "border-rust-600/30 bg-rust-100/30 dark:bg-rust-600/5"
          : insight.severity === "warning"
            ? "border-gold-600/30 bg-gold-50/40 dark:bg-gold-700/5"
            : insight.severity === "positive"
              ? "border-olive-600/30 bg-olive-100/30 dark:bg-olive-600/5"
              : "border-border bg-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <SeverityIcon severity={insight.severity} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium text-foreground">{insight.title}</div>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            {insight.description}
          </p>
          {insight.href ? (
            <Link
              href={insight.href}
              className="inline-flex items-center gap-1 mt-2 text-[12px] text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 dark:text-navy-300 transition-colors"
            >
              {insight.hrefLabel ?? "Abrir"}
              <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function SeverityIcon({ severity }: { severity: Insight["severity"] }) {
  if (severity === "critical") {
    return <AlertTriangle className="w-4 h-4 text-rust-600 shrink-0 mt-0.5" strokeWidth={1.8} />;
  }
  if (severity === "warning") {
    return (
      <TrendingDown className="w-4 h-4 text-gold-700 dark:text-gold-500 shrink-0 mt-0.5" strokeWidth={1.8} />
    );
  }
  if (severity === "positive") {
    return (
      <Sparkles className="w-4 h-4 text-olive-700 dark:text-olive-500 shrink-0 mt-0.5" strokeWidth={1.8} />
    );
  }
  return <Info className="w-4 h-4 text-faint-foreground shrink-0 mt-0.5" strokeWidth={1.8} />;
}
