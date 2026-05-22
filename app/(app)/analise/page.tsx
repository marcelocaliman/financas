import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AnalisePage() {
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title={<>Análise <em className="not-italic font-display italic text-navy-700">financeira</em></>}
        subtitle="Para onde o dinheiro foi, de onde veio, e como vocês mudaram nos últimos meses."
      />
      <ComingSoon
        phase="Fase 2"
        title="Onde o dinheiro virou ritmo."
        description="Barras horizontais por categoria, linha de receitas vs despesas, tabela comparativa mês a mês — tudo respondendo à pergunta única: o que mudou?"
      />
    </>
  );
}
