import Link from "next/link";
import { Settings, Download, RefreshCw, Lock, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { getBensReport } from "@/services/ir/bens";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import { getRendaVariavelReport } from "@/services/ir/renda-variavel";
import { computeImposto } from "@/services/ir/imposto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { BensTable } from "@/components/ir/bens-table";
import { RendimentosTabs } from "@/components/ir/rendimentos-tabs";
import { RendaVariavelTable } from "@/components/ir/renda-variavel-table";
import { ImpostoCompareCard } from "@/components/ir/imposto-compare-card";
import { ExportActions } from "@/components/ir/export-actions";
import { RecomputeDarfsButton } from "@/components/ir/recompute-darfs-button";
import { CloseYearButton } from "@/components/ir/close-year-button";

export const dynamic = "force-dynamic";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export default async function IRYearPage({
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

  const supabase = await createClient();
  const [bens, rendimentos, rv, imposto, { data: snapshot }, { data: settings }, { data: deps }, { data: pays }] =
    await Promise.all([
      getBensReport(year),
      getRendimentosReport(year),
      getRendaVariavelReport(year),
      computeImposto(year),
      supabase
        .from("ir_year_snapshots")
        .select("closed_at")
        .eq("year", year)
        .maybeSingle(),
      supabase.from("ir_settings").select("*").maybeSingle(),
      supabase.from("ir_dependents").select("id, name").eq("is_active", true),
      supabase.from("ir_deductible_payments").select("id, amount, currency").eq("year", year),
    ]);

  const isClosed = !!snapshot?.closed_at;
  const numDependents = (deps ?? []).length;
  const numDeductibles = (pays ?? []).length;

  const totalAtivos = bens.totals.current;
  const totalRendimentos =
    rendimentos.tributaveis.total + rendimentos.isentos.total + rendimentos.exclusivos.total;

  return (
    <>
      <Link
        href="/ir"
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar
      </Link>

      <PageHeader
        eyebrow={`IRPF/${year + 1} · ano-base ${year}`}
        title={
          <>
            Declaração <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">{year}</em>
            {isClosed ? (
              <span className="ml-3 inline-flex items-center gap-1 text-[14px] text-olive-700">
                <Lock className="w-4 h-4" strokeWidth={1.7} />
                fechada
              </span>
            ) : null}
          </>
        }
        subtitle={
          isClosed
            ? `Declaração fechada em ${new Date(snapshot!.closed_at).toLocaleDateString("pt-BR")}. Pode reabrir editando os dados — fechar de novo atualiza o snapshot.`
            : "Revise cada seção, ajuste pagamentos e dependentes, gere DARFs e exporte."
        }
        actions={
          <>
            <Link
              href={`/ir/${year}/configuracoes`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] border border-border-strong text-[13px] hover:bg-surface-muted"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.7} />
              Configurações
            </Link>
            <ExportActions
              year={year}
              cpf={settings?.cpf_titular ?? ""}
              nome={ctx.profile.display_name}
            />
          </>
        }
      />

      {/* TIER 1 — KPIs gerais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total de bens"
          textValue={`R$ ${fmtBRL(totalAtivos)}`}
          tone="neutral"
          hint={`${bens.byGroup.reduce((s, g) => s + g.items.length, 0)} itens em ${bens.byGroup.length} grupos`}
        />
        <KpiCard
          label="Rendimentos totais"
          textValue={`R$ ${fmtBRL(totalRendimentos)}`}
          tone="positive"
          hint={`tribut R$ ${fmtBRL(rendimentos.tributaveis.total)} + isentos R$ ${fmtBRL(rendimentos.isentos.total)}`}
        />
        <KpiCard
          label="DARFs renda variável"
          textValue={`R$ ${fmtBRL(rv.totals.totalTaxDue)}`}
          tone={rv.totals.totalTaxDue > 0 ? "negative" : "muted"}
          hint={`vendas R$ ${fmtBRL(rv.totals.grossSalesYear)} · lucro R$ ${fmtBRL(rv.totals.grossProfitYear)}`}
        />
        <KpiCard
          label={imposto.recommendation === "completo" ? "Modelo Completo (recomendado)" : "Modelo Simples (recomendado)"}
          textValue={
            imposto.recommendation === "completo"
              ? `R$ ${fmtBRL(imposto.completo.netDue)}`
              : `R$ ${fmtBRL(imposto.simples.netDue)}`
          }
          tone={(imposto.recommendation === "completo" ? imposto.completo.netDue : imposto.simples.netDue) > 0 ? "negative" : "positive"}
          hint={
            (imposto.recommendation === "completo" ? imposto.completo.netDue : imposto.simples.netDue) > 0
              ? "imposto a pagar"
              : "restituição"
          }
        />
      </div>

      {/* TIER 2 — Bens e Direitos */}
      <Panel id="bens" className="mb-5">
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              Bens e Direitos
              <Badge tone="navy">31/12/{year}</Badge>
            </span>
          }
          meta={bens.fxNote ? bens.fxNote : "valores em BRL"}
        />
        <BensTable report={bens} />
      </Panel>

      {/* TIER 3 — Rendimentos (3 tabs) */}
      <Panel id="rendimentos" className="mb-5">
        <PanelHeader title="Rendimentos" meta={`ano ${year}`} />
        <RendimentosTabs rendimentos={rendimentos} year={year} />
      </Panel>

      {/* TIER 4 — Renda Variável + DARFs */}
      <Panel id="renda-variavel" className="mb-5">
        <PanelHeader
          title="Renda variável — apuração mensal e DARFs"
          meta={`${rv.swing.filter((m) => m.grossSales > 0).length + rv.dayTrade.filter((m) => m.grossSales > 0).length + rv.fii.filter((m) => m.grossSales > 0).length} meses com operações`}
        />
        <div className="mb-4 flex flex-wrap gap-2 items-center text-[12.5px] text-muted-foreground">
          <Badge tone="navy">Swing 15%</Badge>
          <Badge tone="navy">Day trade 20%</Badge>
          <Badge tone="navy">FII 20%</Badge>
          <Badge tone="olive">Isenção R$ 20k/mês (apenas ações swing)</Badge>
          <RecomputeDarfsButton year={year} />
        </div>
        <RendaVariavelTable report={rv} />
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-[12.5px]">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Prejuízo a compensar — Swing
            </div>
            <div className="font-mono text-[15px] mt-1">R$ {fmtBRL(rv.finalCarryforward.swing)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Prejuízo a compensar — Day
            </div>
            <div className="font-mono text-[15px] mt-1">R$ {fmtBRL(rv.finalCarryforward.day_trade)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Prejuízo a compensar — FII
            </div>
            <div className="font-mono text-[15px] mt-1">R$ {fmtBRL(rv.finalCarryforward.fii)}</div>
          </div>
        </div>
      </Panel>

      {/* TIER 5 — Imposto devido (compare Simples vs Completo) */}
      <Panel id="imposto" className="mb-5">
        <PanelHeader
          title="Imposto a pagar / restituição"
          meta={`${numDependents} dependente${numDependents === 1 ? "" : "s"} · ${numDeductibles} pagamento${numDeductibles === 1 ? "" : "s"} dedutível${numDeductibles === 1 ? "" : "is"}`}
        />
        <ImpostoCompareCard imposto={imposto} />
        <div className="mt-3 text-[12px] text-muted-foreground">
          Ajuste dependentes e pagamentos dedutíveis em{" "}
          <Link href={`/ir/${year}/configuracoes`} className="text-navy-700 dark:text-navy-300">
            Configurações
          </Link>
          .
        </div>
      </Panel>

      {/* TIER 6 — Fechamento */}
      <Panel className="border-navy-700/30">
        <PanelHeader title="Fechar declaração" />
        <p className="text-[13px] text-muted-foreground mb-3">
          Quando finalizar, "feche" pra gerar o snapshot dos bens. Esse snapshot
          serve de base "Situação em 31/12 do ano anterior" na declaração do ano
          que vem — pré-preenchimento automático.
        </p>
        <CloseYearButton year={year} isClosed={isClosed} />
      </Panel>
    </>
  );
}
