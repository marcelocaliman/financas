import Link from "next/link";
import { ChevronLeft, Archive, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { listClosedInvestments } from "@/services/investments";
import { ClosedInvestmentsSection } from "@/components/investments/closed-investments-section";

export const dynamic = "force-dynamic";

export default async function EncerradosPage() {
  const currentYear = new Date().getUTCFullYear();
  // Pega tudo (sem filtro de ano) — o componente oferece tabs por ano
  const closed = await listClosedInvestments();

  return (
    <>
      <Link
        href="/investimentos"
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar pra Investimentos
      </Link>

      <PageHeader
        eyebrow={`Investimentos · ${closed.length} encerrado${closed.length !== 1 ? "s" : ""}`}
        title={
          <>
            <Archive className="inline w-6 h-6 mr-2 -mt-1 text-muted-foreground" strokeWidth={1.6} />
            Ativos{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              encerrados
            </em>
          </>
        }
        subtitle="Vendidos, vencidos ou arquivados. Aparecem aqui pra preservar o histórico — e na declaração IR do ano do fechamento (situação anterior > 0 → situação atual = 0)."
      />

      {closed.length === 0 ? (
        <Panel className="!py-12 grid place-items-center text-center">
          <AlertCircle className="w-6 h-6 text-faint-foreground mb-2" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground max-w-[420px]">
            Nenhum ativo encerrado ainda. Use &quot;Liquidar (vender/vencer)&quot; no menu de
            qualquer ativo da carteira pra registrar venda ou vencimento com IR retido.
          </p>
        </Panel>
      ) : (
        <ClosedInvestmentsSection investments={closed} currentYear={currentYear} />
      )}
    </>
  );
}
