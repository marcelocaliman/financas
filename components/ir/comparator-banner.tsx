import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import type { ComparatorResult } from "@/services/ir/comparator";
import type { MarriageRegime } from "@/types/database";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

const REGIME_LABEL: Record<MarriageRegime, string> = {
  solteiro: "solteiro",
  comunhao_parcial: "comunhão parcial",
  comunhao_universal: "comunhão universal",
  separacao_total: "separação total",
  separacao_obrigatoria: "separação obrigatória",
  participacao_final_aquestos: "participação final nos aquestos",
};

export function ComparatorBanner({
  year,
  comparator,
  regime,
}: {
  year: number;
  comparator: ComparatorResult;
  regime: MarriageRegime;
}) {
  if (!comparator.separate) return null;

  const jointNet = comparator.joint
    ? Math.min(comparator.joint.completo.netDue, comparator.joint.simples.netDue)
    : 0;
  const separateNet = comparator.separate.totalNetDue;
  const savings = comparator.savings;
  const recommendation = comparator.recommendation;

  const isSeparateBetter = recommendation === "separate";

  return (
    <div className="rounded-[12px] border border-olive-200 dark:border-olive-700/50 bg-gradient-to-br from-olive-50 to-bone-50 dark:from-olive-900/20 dark:to-ink-900 p-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-8 h-8 rounded-full bg-olive-100 dark:bg-olive-700/30 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-olive-700 dark:text-olive-100" strokeWidth={1.7} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-olive-700 dark:text-olive-100 font-medium mb-1">
            Comparador conjunta vs separada
          </div>
          <p className="text-[13.5px] text-foreground">
            Pelo regime de {REGIME_LABEL[regime]}, declarando{" "}
            <b>{isSeparateBetter ? "separado" : "em conjunto"}</b> vocês pagam{" "}
            <b className="text-olive-700 dark:text-olive-100">{fmtBRL(savings)}</b> a menos.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-[12px] font-mono">
            <div className="rounded-[6px] bg-surface border border-border px-3 py-2">
              <div className="text-faint-foreground text-[10.5px] uppercase tracking-[0.1em]">Conjunta</div>
              <div className="text-foreground tabular-nums mt-0.5">{fmtBRL(jointNet)}</div>
            </div>
            <div className="rounded-[6px] bg-surface border border-border px-3 py-2">
              <div className="text-faint-foreground text-[10.5px] uppercase tracking-[0.1em]">Separadas (soma)</div>
              <div className="text-foreground tabular-nums mt-0.5">{fmtBRL(separateNet)}</div>
            </div>
          </div>
          {isSeparateBetter ? (
            <div className="mt-3 flex items-center gap-3 text-[12.5px]">
              <Link
                href={`/ir/${year}?filer=${comparator.separate.primary?.filerId}`}
                className="inline-flex items-center gap-1 text-navy-700 dark:text-navy-300 hover:underline"
              >
                Ver declaração de {comparator.separate.primary?.filerName.split(" ")[0]}
                <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
              </Link>
              <Link
                href={`/ir/${year}?filer=${comparator.separate.secondary?.filerId}`}
                className="inline-flex items-center gap-1 text-navy-700 dark:text-navy-300 hover:underline"
              >
                Ver declaração de {comparator.separate.secondary?.filerName.split(" ")[0]}
                <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
