import { Plus, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function TransacoesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Histórico"
        title={<>Todas as <em className="not-italic font-display italic text-navy-700">transações</em></>}
        subtitle="Toda movimentação que passou pelas suas contas — receita, despesa, transferência."
        actions={
          <>
            <Button variant="secondary">
              <Download className="w-3.5 h-3.5" strokeWidth={1.7} />
              Exportar
            </Button>
            <Button variant="primary">
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Adicionar
            </Button>
          </>
        }
      />
      <ComingSoon
        phase="Fase 1 · em construção"
        title={<>Lista completa, filtros e busca.</>}
        description="CRUD de transações, multi-select pra edição em massa, filtros por mês, conta e categoria — chegando nas próximas iterações."
      />
    </>
  );
}
