import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function InvestimentosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Patrimônio"
        title={<>A carteira <em className="not-italic font-display italic text-navy-700">respirando.</em></>}
        subtitle="Os ativos atualizam com a Selic do dia · fonte: Banco Central."
      />
      <ComingSoon
        phase="Fase 3"
        title="Tesouro Selic ao vivo, DY anualizado, cobertura."
        description="A carteira renderiza com saldo crescendo a cada segundo. Edge function diária consome o BCB e recalcula tudo de madrugada."
      />
    </>
  );
}
