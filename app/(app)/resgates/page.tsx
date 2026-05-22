import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function ResgatesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Renda passiva"
        title={<>Tirar renda para <em className="not-italic font-display italic text-navy-700">viver.</em></>}
        subtitle="Configure o saque mensal de cada ativo. O app lembra você no dia certo, com o valor certo."
      />
      <ComingSoon
        phase="Fase 4"
        title="Lembretes, fluxo origem → destino, projeção 5 anos."
        description="Três modos de saque: reinvestir, valor sugerido editável, % do rendimento. Mês a mês, com histórico real."
      />
    </>
  );
}
