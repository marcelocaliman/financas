import Link from "next/link";
import { ChevronLeft, FileText, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getCurrentUserContext } from "@/services/auth";
import { getAuditTotals } from "@/services/ir/audit";
import { AuditRow } from "@/components/ir/audit-row";
import { AiAuditPanel } from "@/components/ir/ai-audit-panel";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year)) return <div>Ano inválido</div>;

  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const audit = await getAuditTotals(year, ctx.household.id);

  return (
    <>
      <Link
        href={`/ir/${year}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar para IRPF/{year + 1}
      </Link>

      <PageHeader
        eyebrow={`IRPF/${year + 1} · auditoria pré-fechamento`}
        title={
          <>
            Confere se{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              tudo bate
            </em>
          </>
        }
        subtitle={`Cole na coluna "Oficial" os valores dos informes que você receber (XP, banco, plano de saúde, contador). O app marca em verde o que bate, em vermelho o que diverge mais de 5%. Use em janeiro/${year + 1} antes de exportar.`}
      />

      <AiAuditPanel year={year} />

      <Panel className="mb-5 border-navy-700/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-1">
              Como usar
            </div>
            <p className="text-[13px] leading-relaxed">
              Em fev/{year + 1} a XP, seu banco e o plano de saúde vão emitir{" "}
              <b>informes anuais de rendimentos</b>. Pegue cada um e cole o valor total
              ao lado do que o app calculou. Se bater (verde), pronto. Se divergir mais
              de R$ 1 (amarelo) ou 5% (vermelho), ache o que está faltando lançar no app
              antes de fechar a declaração.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Identificação"
          meta={`${audit.filerCount} declarante(s) · ${audit.dependentCount} dependente(s)`}
        />
        <p className="text-[12px] text-muted-foreground">
          Configure declarantes e dependentes em <code>/ir/{year}/configuracoes</code>. Não
          tem comparativo automático aqui — só números do app.
        </p>
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Rendimentos"
          meta="Compare com seu informe de rendimentos (PJ, banco, corretora)"
        />
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th className="text-left pb-2 font-medium">Item</th>
              <th className="text-right pb-2 pr-3 font-medium w-[160px]">App calculou</th>
              <th className="text-right pb-2 pr-3 font-medium w-[180px]">Oficial (informe)</th>
              <th className="text-right pb-2 pr-3 font-medium w-[140px]">Diferença</th>
              <th className="text-center pb-2 font-medium w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            <AuditRow
              label="Rendimentos tributáveis PJ"
              hint="Pró-labore + salário CLT (titular)"
              appValue={audit.rendimentosTributaveisPJ}
              storageKey={`audit:${year}:rend_trib_pj`}
            />
            <AuditRow
              label="Rendimentos isentos"
              hint="Distribuição de lucros PJ + dividendos + FII + LCI/LCA"
              appValue={audit.rendimentosIsentos}
              storageKey={`audit:${year}:rend_isentos`}
            />
            <AuditRow
              label="Rendimentos exclusivos na fonte"
              hint="CDB, Tesouro, juros sobre capital — informe XP"
              appValue={audit.rendimentosExclusivos}
              storageKey={`audit:${year}:rend_exclusivos`}
            />
            <AuditRow
              label="Total IRRF retido"
              hint="Soma do IR retido no ano"
              appValue={audit.totalIrrf}
              storageKey={`audit:${year}:total_irrf`}
            />
            <AuditRow
              label="Total INSS"
              hint="Contribuição previdenciária paga"
              appValue={audit.totalInss}
              storageKey={`audit:${year}:total_inss`}
            />
          </tbody>
        </table>
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Bens e Direitos"
          meta="Compare com extrato 31/12 das contas, corretora e bens cadastrados"
        />
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th className="text-left pb-2 font-medium">Item</th>
              <th className="text-right pb-2 pr-3 font-medium w-[160px]">App</th>
              <th className="text-right pb-2 pr-3 font-medium w-[180px]">Oficial</th>
              <th className="text-right pb-2 pr-3 font-medium w-[140px]">Diferença</th>
              <th className="text-center pb-2 font-medium w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            <AuditRow
              label={`Total bens em 31/12/${year - 1}`}
              hint="Vem do snapshot do ano anterior (situação anterior)"
              appValue={audit.bensTotalAnterior}
              storageKey={`audit:${year}:bens_anterior`}
            />
            <AuditRow
              label={`Total bens em 31/12/${year}`}
              hint={`Calculado a partir dos saldos atuais. ${audit.bensCount} bens cadastrados`}
              appValue={audit.bensTotalAtual}
              storageKey={`audit:${year}:bens_atual`}
            />
            <AuditRow
              label="Total dívidas em 31/12"
              hint={`${audit.dividasDeclarableCount} dívidas > R$ 5k (obrigatórias declarar)`}
              appValue={audit.dividasTotalAtual}
              storageKey={`audit:${year}:dividas`}
            />
          </tbody>
        </table>
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Pagamentos Dedutíveis"
          meta="Compare com recibos e faturas do ano (saúde, educação, INSS, PGBL)"
        />
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th className="text-left pb-2 font-medium">Categoria</th>
              <th className="text-right pb-2 pr-3 font-medium w-[160px]">App</th>
              <th className="text-right pb-2 pr-3 font-medium w-[180px]">Oficial</th>
              <th className="text-right pb-2 pr-3 font-medium w-[140px]">Diferença</th>
              <th className="text-center pb-2 font-medium w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(audit.deductiblesByKind).map(([kind, total]) => (
              <AuditRow
                key={kind}
                label={DEDUCTIBLE_LABELS[kind] ?? kind}
                hint={`Soma dos pagamentos cadastrados com kind=${kind}`}
                appValue={total}
                storageKey={`audit:${year}:ded:${kind}`}
              />
            ))}
            <AuditRow
              label="TOTAL dedutíveis"
              appValue={audit.deductiblesTotal}
              storageKey={`audit:${year}:ded_total`}
            />
          </tbody>
        </table>
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Cálculo do Imposto"
          meta={`Modelo recomendado: ${audit.recomendacao === "completo" ? "Completo" : "Simples"}`}
        />
        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div className="rounded-[8px] border border-border bg-surface p-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground mb-1">
              Modelo simples (20% desconto)
            </div>
            <div className="text-[20px] font-mono tabular-nums">
              R$ {audit.impostoSimples.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {audit.impostoSimples > 0 ? "A pagar" : audit.impostoSimples < 0 ? "A restituir" : "Sem imposto"}
            </div>
          </div>
          <div className="rounded-[8px] border border-border bg-surface p-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground mb-1">
              Modelo completo (deduções)
            </div>
            <div className="text-[20px] font-mono tabular-nums">
              R$ {audit.impostoCompleto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {audit.impostoCompleto > 0 ? "A pagar" : audit.impostoCompleto < 0 ? "A restituir" : "Sem imposto"}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="border-gold-600/30">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-gold-700 dark:text-gold-200 shrink-0 mt-0.5" strokeWidth={1.7} />
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gold-700 dark:text-gold-200 font-medium mb-1">
              Onde encontrar os valores oficiais
            </div>
            <ul className="text-[12.5px] space-y-1.5 mt-2 text-muted-foreground">
              <li>
                <b className="text-foreground">Corretora</b>: portal cliente → Imposto de
                Renda → Informe de Rendimentos {year}. Sai em fev/{year + 1}. Contém Tesouros,
                dividendos, ações, FIIs.
              </li>
              <li>
                <b className="text-foreground">PJ (se você é sócio)</b>: peça ao contador o informe
                de rendimentos da PJ pra o sócio (pró-labore + distribuição de lucros).
              </li>
              <li>
                <b className="text-foreground">Plano de saúde</b>: portal da operadora → demonstrativo IR.
              </li>
              <li>
                <b className="text-foreground">Banco</b>: extratos de 31/12 + informe de
                rendimentos anual.
              </li>
              <li>
                <b className="text-foreground">Corretora ações</b>: informe de movimentações
                anuais pra calcular ganho de capital em vendas.
              </li>
            </ul>
          </div>
        </div>
      </Panel>
    </>
  );
}

const DEDUCTIBLE_LABELS: Record<string, string> = {
  plano_saude: "Plano de saúde",
  hospital: "Hospital / exames",
  medico: "Médico",
  dentista: "Dentista",
  psicologo: "Psicólogo",
  outros_saude: "Outros saúde",
  educacao_titular: "Educação titular",
  educacao_dependente: "Educação dependente",
  inss_titular: "INSS titular",
  inss_domestico: "INSS doméstico",
  pgbl: "PGBL",
  previdencia_privada: "Previdência privada",
  pensao_alimenticia: "Pensão alimentícia",
  honorarios_advocaticios_pensao: "Honorários advogado (pensão)",
  doacao_eca: "Doação ECA",
  doacao_cultural: "Doação Lei Rouanet",
  outros: "Outros",
};
