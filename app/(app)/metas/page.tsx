import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function MetasPage() {
  return (
    <>
      <PageHeader
        eyebrow="Objetivos"
        title={<>Metas e <em className="not-italic font-display italic text-navy-700">sonhos.</em></>}
        subtitle="Cada meta com data, valor e trajetória — calculada pelo seu ritmo real."
      />
      <ComingSoon
        phase="Fase 5"
        title="Casa, viagem, reserva — com data realista."
        description="A conclusão prevista vem do ritmo de aporte dos últimos meses, não de média idealizada."
      />
    </>
  );
}
