import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/services/auth";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import { IncomeReview } from "@/components/ir/income-review";

export const dynamic = "force-dynamic";

export default async function IrReviewPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return <div>Ano inválido</div>;
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const report = await getRendimentosReport(year, ctx.household.id);
  const pending = report.naoClassificados.rows;

  return (
    <>
      <Link
        href={`/ir/${year}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar pra declaração {year}
      </Link>

      <PageHeader
        eyebrow={`IRPF · ano-base ${year}`}
        title="Revisão de rendimentos"
        subtitle={
          pending.length > 0
            ? `${pending.length} renda(s) que o cálculo não classificou sozinho. Resolva cada uma pra a estimativa deixar de ser provisória.`
            : "Tudo classificado — sua estimativa está completa."
        }
      />

      <IncomeReview year={year} pending={pending} />
    </>
  );
}
