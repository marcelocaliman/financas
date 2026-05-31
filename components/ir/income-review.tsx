"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { formatMoney } from "@/lib/utils/format";
import { setIncomeClassification } from "@/services/ir/classify-income.actions";
import type { RendimentoRow, IncomeOverrideBucket } from "@/services/ir/rendimentos";
import { cn } from "@/lib/utils/cn";

const BUCKETS: { value: IncomeOverrideBucket; label: string; help: string }[] = [
  { value: "tributavel", label: "Tributável", help: "Entra na base progressiva" },
  { value: "isento", label: "Isento", help: "Não tributado (dividendos, etc.)" },
  { value: "exclusivo", label: "Exclusivo na fonte", help: "Já tributado (RF, 13º)" },
];

/**
 * Modo revisão: o usuário resolve cada renda que o motor não classificou.
 * Enquanto houver pendência, a estimativa fica "provisória" e o export final
 * é bloqueado (D8).
 */
export function IncomeReview({
  year,
  pending,
}: {
  year: number;
  pending: RendimentoRow[];
}) {
  if (pending.length === 0) {
    return (
      <Panel className="text-center py-10">
        <Check className="w-7 h-7 mx-auto text-olive-600" strokeWidth={1.7} />
        <p className="mt-3 text-[14px] font-medium text-foreground">
          Nada a revisar — toda a renda está classificada.
        </p>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Sua estimativa de IR está completa pra {year}.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((row) => (
        <ReviewRow key={row.originKey} year={year} row={row} />
      ))}
    </div>
  );
}

function ReviewRow({ year, row }: { year: number; row: RendimentoRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolved, setResolved] = useState(false);

  function choose(bucket: IncomeOverrideBucket) {
    if (!row.originKey) return;
    startTransition(async () => {
      const res = await setIncomeClassification({ year, originKey: row.originKey!, bucket });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setResolved(true);
      toast.success("Classificação salva.");
      router.refresh();
    });
  }

  return (
    <Panel className={cn("transition-opacity", resolved && "opacity-50")}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-foreground">{row.description}</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {row.payerName} · {row.reason}
          </div>
          <div className="font-mono text-[15px] text-foreground mt-1.5">
            {formatMoney(row.grossAmount)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {BUCKETS.map((b) => (
            <button
              key={b.value}
              disabled={pending}
              onClick={() => choose(b.value)}
              title={b.help}
              className="rounded-[7px] border border-border-strong px-3 py-2 text-[12.5px] hover:bg-surface-muted disabled:opacity-50"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
