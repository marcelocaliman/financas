import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function ContasPage() {
  return (
    <>
      <PageHeader
        eyebrow="Onde o dinheiro mora"
        title={<>Suas <em className="not-italic font-display italic text-navy-700">contas.</em></>}
        subtitle="Cartões, contas correntes, corretoras, dinheiro vivo — todos os endereços do seu patrimônio."
        actions={
          <Button variant="primary">
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Nova conta
          </Button>
        }
      />
      <ComingSoon
        phase="Fase 1 · em construção"
        title="CRUD de contas + cartões."
        description="Cadastro, edição e arquivo. Saldos calculados a partir das transações."
      />
    </>
  );
}
