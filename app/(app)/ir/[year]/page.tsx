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
import { CarneLeaoManager } from "@/components/ir/carne-leao-manager";
import { listCarneLeao } from "@/services/ir/carne-leao";
import { getExteriorReport, getCryptoReport } from "@/services/ir/exterior-crypto";
import { NotesPanel, type AccountantNoteWithAuthor } from "@/components/accountant/notes-panel";
import { NotesRealtimeSync } from "@/components/accountant/notes-realtime";
import { listFilers, getRegimeContext } from "@/services/ir/filers";
import { compareDeclarationStrategies } from "@/services/ir/comparator";
import { getChecklistReport } from "@/services/ir/checklist";
import { detectRetroactiveGaps } from "@/services/ir/retroactive-gaps";
import { FilerSwitcher } from "@/components/ir/filer-switcher";
import { ComparatorBanner } from "@/components/ir/comparator-banner";
import { ChecklistPanel } from "@/components/ir/checklist-panel";
import { RetroactiveGapsBanner } from "@/components/ir/retroactive-gaps-banner";

export const dynamic = "force-dynamic";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export default async function IRYearPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ filer?: string }>;
}) {
  const { year: yearStr } = await params;
  const { filer: filerParam } = await searchParams;
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return <div>Ano inválido</div>;
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  // Carrega filers + regime upfront
  const [filers, regimeCtx] = await Promise.all([
    listFilers(ctx.household.id),
    getRegimeContext(ctx.household.id),
  ]);
  // Valida que o filer pedido pertence ao household; senão cai pra conjunta
  const selectedFiler = filerParam
    ? filers.find((f) => f.id === filerParam)
    : null;
  const filerId = selectedFiler?.id;
  const isCouple = filers.length >= 2;

  // Comparator só faz sentido pra casal e na "visão geral" (sem filer fixado)
  const [comparator, checklist, retroactiveGaps] = await Promise.all([
    isCouple && !filerId ? compareDeclarationStrategies(year, ctx.household.id) : Promise.resolve(null),
    getChecklistReport(year, ctx.household.id),
    detectRetroactiveGaps(year),
  ]);

  const supabase = await createClient();
  const [
    bens,
    rendimentos,
    rv,
    imposto,
    exterior,
    crypto,
    carneLeao,
    { data: snapshot },
    { data: settings },
    { data: deps },
    { data: pays },
    { data: notes },
  ] = await Promise.all([
      getBensReport(year, ctx.household.id, filerId),
      getRendimentosReport(year, ctx.household.id, filerId),
      getRendaVariavelReport(year, ctx.household.id, filerId),
      computeImposto(year, ctx.household.id, filerId),
      getExteriorReport(year),
      getCryptoReport(year),
      listCarneLeao(year),
      supabase
        .from("ir_year_snapshots")
        .select("closed_at")
        .eq("year", year)
        .maybeSingle(),
      supabase.from("ir_settings").select("*").maybeSingle(),
      supabase.from("ir_dependents").select("id, name").eq("is_active", true),
      supabase.from("ir_deductible_payments").select("id, amount, currency").eq("year", year),
      supabase
        .from("accountant_notes")
        .select("*, accountant:accountant_profiles(full_name)")
        .eq("year", year)
        .order("created_at", { ascending: false }),
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
              href={`/ir/${year}/auditoria`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] border border-border-strong text-[13px] hover:bg-surface-muted"
              title="Compare valores do app com informes oficiais antes de exportar"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.7} />
              Auditoria
            </Link>
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

      <NotesRealtimeSync />

      {/* Switcher de declarante (só aparece pra casal) */}
      {isCouple ? (
        <div className="mb-5">
          <FilerSwitcher year={year} filers={filers} selectedId={filerId ?? null} />
        </div>
      ) : null}

      {/* Banner do comparador conjunta vs separada */}
      {comparator?.separate && comparator.recommendation === "separate" ? (
        <ComparatorBanner
          year={year}
          comparator={comparator}
          regime={regimeCtx.regime}
        />
      ) : null}

      {/* Banner de lacunas retroativas — só aparece se há recorrência com meses faltando */}
      <RetroactiveGapsBanner gaps={retroactiveGaps} />

      {/* Checklist pré-exportação */}
      <ChecklistPanel report={checklist} />

      {/* Anotações do contador (se houver) */}
      {ctx && notes && notes.length > 0 ? (
        <NotesPanel
          householdId={ctx.household.id}
          year={year}
          notes={(notes ?? []) as unknown as AccountantNoteWithAuthor[]}
          isAccountant={false}
        />
      ) : null}

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
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 lg:grid-cols-4 gap-4 text-[12.5px]">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Prejuízo — Swing
            </div>
            <div className="font-mono text-[15px] mt-1">R$ {fmtBRL(rv.finalCarryforward.swing)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Prejuízo — Day
            </div>
            <div className="font-mono text-[15px] mt-1">R$ {fmtBRL(rv.finalCarryforward.day_trade)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Prejuízo — FII
            </div>
            <div className="font-mono text-[15px] mt-1">R$ {fmtBRL(rv.finalCarryforward.fii)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Prejuízo — Opções
            </div>
            <div className="font-mono text-[15px] mt-1">R$ {fmtBRL(rv.finalCarryforward.options)}</div>
          </div>
        </div>
      </Panel>

      {/* TIER 4.5 — Carnê-leão mensal */}
      <Panel id="carne-leao" className="mb-5">
        <PanelHeader
          title="Carnê-leão — aluguel, freelance, exterior"
          meta="DARF 0190 mensal, vence dia útil seguinte"
        />
        <CarneLeaoManager year={year} entries={carneLeao} />
      </Panel>

      {/* TIER 4.6 — Exterior + cripto */}
      {(exterior.byAsset.length > 0 || crypto.monthly.some((m) => m.grossSales > 0)) ? (
        <Panel id="exterior-crypto" className="mb-5">
          <PanelHeader
            title="Aplicações no exterior + cripto"
            meta="Lei 14.754/2023 — 15% sobre lucro anual"
          />
          {exterior.byAsset.length > 0 ? (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge tone="navy">Exterior · {exterior.byAsset.length} ativos</Badge>
                <span className="text-[12px] text-muted-foreground">
                  Lucro anual R$ {fmtBRL(exterior.totalProfitBRL)} ·
                  imposto R$ {fmtBRL(exterior.taxDue)}
                </span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-faint-foreground font-mono text-[10px] uppercase tracking-[0.12em]">
                    <th className="text-left pb-1 font-medium">Ticker</th>
                    <th className="text-left pb-1 font-medium">Nome</th>
                    <th className="text-right pb-1 font-medium">Compras</th>
                    <th className="text-right pb-1 font-medium">Vendas</th>
                    <th className="text-right pb-1 font-medium">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {exterior.byAsset.map((a) => (
                    <tr key={a.investmentId} className="border-t border-border">
                      <td className="py-1.5 font-mono text-foreground">{a.ticker}</td>
                      <td className="py-1.5 text-muted-foreground truncate">{a.name}</td>
                      <td className="py-1.5 font-mono text-right tabular-nums">R$ {fmtBRL(a.totalBoughtBRL)}</td>
                      <td className="py-1.5 font-mono text-right tabular-nums">R$ {fmtBRL(a.totalSoldBRL)}</td>
                      <td className={"py-1.5 font-mono text-right tabular-nums " + (a.profitBRL >= 0 ? "text-olive-700" : "text-rust-600")}>R$ {fmtBRL(a.profitBRL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {crypto.monthly.some((m) => m.grossSales > 0) ? (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Badge tone="gold">Criptoativos</Badge>
                <span className="text-[12px] text-muted-foreground">
                  Imposto total ano: R$ {fmtBRL(crypto.totalTaxDue)}
                </span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-faint-foreground font-mono text-[10px] uppercase tracking-[0.12em]">
                    <th className="text-left pb-1 font-medium">Mês</th>
                    <th className="text-right pb-1 font-medium">Vendas</th>
                    <th className="text-right pb-1 font-medium">Lucro</th>
                    <th className="text-right pb-1 font-medium">DARF</th>
                  </tr>
                </thead>
                <tbody>
                  {crypto.monthly.filter((m) => m.grossSales > 0).map((m) => {
                    const monthLabel = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][m.month - 1];
                    return (
                      <tr key={m.month} className="border-t border-border">
                        <td className="py-1.5 font-mono text-foreground">{monthLabel}</td>
                        <td className="py-1.5 font-mono text-right tabular-nums">R$ {fmtBRL(m.grossSales)}</td>
                        <td className="py-1.5 font-mono text-right tabular-nums">R$ {fmtBRL(m.profit)}</td>
                        <td className="py-1.5 font-mono text-right tabular-nums">
                          {m.isExempt ? <span className="text-olive-700">isento</span> : `R$ ${fmtBRL(m.taxDue)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      ) : null}

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
