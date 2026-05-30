import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatMoneyCompact } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { cn } from "@/lib/utils/cn";

type Row = {
  month: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

/**
 * Resumo enxuto do mês mais recente (Entrou / Saiu / Sobra) com link pra
 * /análise — que é a fonte canônica do recorte mês a mês (tabela completa +
 * tendência). Substitui o gráfico de barras 6m que duplicava /análise no
 * dashboard.
 */
export function MonthPulseCard({ data }: { data: Row[] }) {
  if (data.length === 0) return null;
  const last = data[data.length - 1];
  const avgNet = data.reduce((s, r) => s + r.net, 0) / data.length;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <PanelHeader title="Pulso do mês" meta={last.label} className="!mb-0" />
        <Link
          href="/analise"
          className="inline-flex items-center gap-1 text-[12px] text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 shrink-0"
        >
          Ver análise completa
          <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <Stat label="Entrou" value={last.income} tone="positive" />
        <Stat label="Saiu" value={last.expense} tone="negative" />
        <Stat label="Sobra" value={last.net} tone={last.net >= 0 ? "positive" : "negative"} signed />
      </div>

      <div className="mt-3 pt-3 border-t border-border font-mono text-[11px] text-faint-foreground">
        Média de sobra nos últimos {data.length} meses:{" "}
        <span className={cn(avgNet >= 0 ? "text-olive-700 dark:text-olive-500" : "text-rust-600")}>
          <MoneyMask>{formatMoneyCompact(avgNet)}</MoneyMask>
        </span>
      </div>
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone,
  signed,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative";
  signed?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[15px] tracking-[-0.01em]",
          value === 0
            ? "text-foreground"
            : tone === "positive"
              ? "text-olive-700 dark:text-olive-500"
              : "text-rust-600",
        )}
      >
        {signed && value > 0 ? "+" : signed && value < 0 ? "−" : ""}
        <MoneyMask>{formatMoneyCompact(Math.abs(value))}</MoneyMask>
      </div>
    </div>
  );
}
