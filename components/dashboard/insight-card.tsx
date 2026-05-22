import Link from "next/link";
import { AlertCircle, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { ExpenseAnomaly } from "@/services/transactions";

export function InsightCard({ anomalies }: { anomalies: ExpenseAnomaly[] }) {
  if (anomalies.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-surface border border-border px-7 py-5 mb-6 flex items-start gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-olive-600" />
        <div className="w-9 h-9 rounded-[10px] bg-olive-100 text-olive-700 grid place-items-center shrink-0">
          <Sparkles className="w-4 h-4" strokeWidth={1.6} />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
            Nada fora do <em className="italic">comum</em>.
          </h3>
          <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-1">
            Nenhuma categoria estourou a média recente esse mês. Ritmo redondo.
          </p>
        </div>
      </div>
    );
  }

  const top = anomalies[0];
  const pct = Math.round(top.pctAbove * 100);
  const severityColor = top.severity === "high" ? "rust" : "gold";

  return (
    <div className="rounded-[var(--radius-lg)] bg-surface border border-border px-7 py-5 mb-6 flex items-start gap-4 relative overflow-hidden">
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${
          severityColor === "rust" ? "bg-rust-600" : "bg-gold-600"
        }`}
      />
      <div
        className={`w-9 h-9 rounded-[10px] grid place-items-center shrink-0 ${
          severityColor === "rust" ? "bg-rust-100 text-rust-700" : "bg-gold-100 text-gold-700"
        }`}
      >
        <AlertCircle className="w-4 h-4" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
          Gasto atípico em{" "}
          <em className="italic">{top.categoryName.toLowerCase()}</em>
        </h3>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-1">
          Vocês gastaram <MoneyMask>{formatMoney(top.currentTotal)}</MoneyMask> esse mês — {pct}% acima da média
          dos últimos 3 meses (<MoneyMask>{formatMoney(top.averagePrior)}</MoneyMask>). Talvez seja só uma fase
          corrida; ainda assim, vale uma olhada.
        </p>
        <Link
          href={`/transacoes?kind=expense${top.categoryId ? "" : ""}`}
          className="inline-block mt-2 text-[12.5px] font-medium text-navy-700 hover:text-navy-900"
        >
          Ver lançamentos →
        </Link>
        {anomalies.length > 1 ? (
          <p className="text-[11.5px] text-faint-foreground font-mono mt-2">
            + {anomalies.length - 1} {anomalies.length - 1 === 1 ? "outra" : "outras"} categoria{anomalies.length - 1 === 1 ? "" : "s"} acima da média
          </p>
        ) : null}
      </div>
    </div>
  );
}
