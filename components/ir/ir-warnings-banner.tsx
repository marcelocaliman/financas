import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { formatMoney } from "@/lib/utils/format";
import type { IrWarning, IrWarningSeverity } from "@/services/ir/warnings";
import { cn } from "@/lib/utils/cn";

/**
 * Banner dos avisos do motor de IR. Materializa a regra fail-loud (D7): renda
 * não classificada / aluguel a verificar / tabela estimada NUNCA passam
 * despercebidos. Agrupa por código pra não repetir e ordena por severidade.
 */
export function IrWarningsBanner({ warnings }: { warnings: IrWarning[] }) {
  if (!warnings.length) return null;

  // Agrupa por código, somando valores e contando ocorrências.
  const byCode = new Map<
    string,
    { sample: IrWarning; count: number; amount: number }
  >();
  for (const w of warnings) {
    const g = byCode.get(w.code) ?? { sample: w, count: 0, amount: 0 };
    g.count += 1;
    g.amount += w.amount ?? 0;
    byCode.set(w.code, g);
  }

  const order: Record<IrWarningSeverity, number> = { critico: 0, atencao: 1, info: 2 };
  const groups = [...byCode.values()].sort(
    (a, b) => order[a.sample.severity] - order[b.sample.severity],
  );

  return (
    <div className="mb-5 space-y-2" role="alert" aria-label="Avisos do cálculo de IR">
      {groups.map((g) => (
        <WarningRow key={g.sample.code} group={g} />
      ))}
    </div>
  );
}

function WarningRow({
  group,
}: {
  group: { sample: IrWarning; count: number; amount: number };
}) {
  const { sample, count, amount } = group;
  const tone =
    sample.severity === "critico"
      ? "border-rust-600/40 bg-rust-100/40 dark:bg-rust-700/10 text-rust-700 dark:text-rust-400"
      : sample.severity === "atencao"
        ? "border-gold-600/40 bg-gold-100/40 dark:bg-gold-700/10 text-gold-700 dark:text-gold-500"
        : "border-navy-600/30 bg-navy-100/30 dark:bg-navy-700/10 text-navy-700 dark:text-navy-300";
  const Icon =
    sample.severity === "critico"
      ? AlertCircle
      : sample.severity === "atencao"
        ? AlertTriangle
        : Info;

  return (
    <div className={cn("flex items-start gap-2.5 rounded-[8px] border px-3.5 py-2.5", tone)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.8} />
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        <span className="text-foreground">{sample.message}</span>
        {amount > 0 ? (
          <span className="text-muted-foreground">
            {" "}
            ({count > 1 ? `${count} itens · ` : ""}
            {formatMoney(amount)} afetados)
          </span>
        ) : count > 1 ? (
          <span className="text-muted-foreground"> ({count} ocorrências)</span>
        ) : null}
      </div>
    </div>
  );
}
