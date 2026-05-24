import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Lock, Download } from "lucide-react";
import { headers } from "next/headers";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { getBensReport } from "@/services/ir/bens";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import { getRendaVariavelReport } from "@/services/ir/renda-variavel";
import { computeImposto } from "@/services/ir/imposto";
import { createClient } from "@/lib/supabase/server";
import {
  assertAccountantAccess,
  logAccountantAction,
} from "@/services/accountant-auth";
import { BensTable } from "@/components/ir/bens-table";
import { RendimentosTabs } from "@/components/ir/rendimentos-tabs";
import { RendaVariavelTable } from "@/components/ir/renda-variavel-table";
import { ImpostoCompareCard } from "@/components/ir/imposto-compare-card";
import { AccountantExportActions } from "@/components/accountant/export-actions";
import { YearSwitcher } from "@/components/accountant/year-switcher";
import { NotesPanel } from "@/components/accountant/notes-panel";
import { listCarneLeao } from "@/services/ir/carne-leao";
import { getExteriorReport, getCryptoReport } from "@/services/ir/exterior-crypto";

export const dynamic = "force-dynamic";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export default async function ContadorIRYearPage({
  params,
}: {
  params: Promise<{ householdId: string; year: string }>;
}) {
  const { householdId, year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) notFound();

  const access = await assertAccountantAccess(householdId, year);
  if (!access) notFound();

  // Audit
  const hdrs = await headers();
  await logAccountantAction({
    householdId,
    action: "view_year",
    targetYear: year,
    ip: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip"),
    userAgent: hdrs.get("user-agent"),
  });

  const [bens, rendimentos, rv, imposto, exterior, crypto, carneLeao, { data: snapshot }, { data: settings }, { data: notes }] =
    await Promise.all([
      getBensReport(year, householdId),
      getRendimentosReport(year, householdId),
      getRendaVariavelReport(year, householdId),
      computeImposto(year, householdId),
      getExteriorReport(year, householdId),
      getCryptoReport(year, householdId),
      listCarneLeao(year, householdId),
      createClient().then((s) =>
        s
          .from("ir_year_snapshots")
          .select("closed_at")
          .eq("household_id", householdId)
          .eq("year", year)
          .maybeSingle(),
      ),
      createClient().then((s) =>
        s
          .from("ir_settings")
          .select("*")
          .eq("household_id", householdId)
          .maybeSingle(),
      ),
      createClient().then((s) =>
        s
          .from("accountant_notes")
          .select("*, accountant:accountant_profiles(full_name)")
          .eq("household_id", householdId)
          .eq("year", year)
          .order("created_at", { ascending: false }),
      ),
    ]);

  const isClosed = !!snapshot?.closed_at;

  const totalAtivos = bens.totals.current;
  const totalRendimentos =
    rendimentos.tributaveis.total + rendimentos.isentos.total + rendimentos.exclusivos.total;

  return (
    <>
      <Link
        href="/contador"
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Todos os clientes
      </Link>

      <PageHeader
        eyebrow={`${access.household.name}${access.titularName ? ` · ${access.titularName}` : ""}`}
        title={
          <span className="inline-flex items-baseline gap-3">
            IRPF{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              {year}
            </em>
            {isClosed ? (
              <span className="inline-flex items-center gap-1 text-[14px] text-olive-700">
                <Lock className="w-4 h-4" strokeWidth={1.7} />
                fechada pelo titular
              </span>
            ) : null}
          </span>
        }
        subtitle={
          isClosed
            ? `Declaração fechada em ${new Date(snapshot!.closed_at).toLocaleDateString("pt-BR")} pelo titular. Pode exportar.`
            : "Dados sendo preparados pelo titular. Você pode visualizar e exportar (.DEC ou TXT) a qualquer momento."
        }
        actions={
          <>
            <YearSwitcher
              householdId={householdId}
              years={access.access.years_allowed}
              currentYear={year}
            />
            <AccountantExportActions
              year={year}
              householdId={householdId}
              hasCpf={!!settings?.cpf_titular}
            />
          </>
        }
      />

      {/* Banner LGPD */}
      <Panel className="mb-5 border-navy-700/30">
        <p className="text-[12.5px] text-muted-foreground">
          <b className="text-foreground">Acesso somente-leitura.</b> Cada
          visualização e download fica registrado no audit log do titular. Você
          está agindo conforme termo de tratamento de dados aceito no
          onboarding.
        </p>
      </Panel>

      {/* Anotações do contador */}
      <NotesPanel
        householdId={householdId}
        year={year}
        notes={(notes ?? []) as never}
        isAccountant={true}
      />

      {/* TIER 1 — KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total de bens"
          textValue={`R$ ${fmtBRL(totalAtivos)}`}
          tone="neutral"
          hint={`${bens.byGroup.reduce((s, g) => s + g.items.length, 0)} itens`}
        />
        <KpiCard
          label="Rendimentos totais"
          textValue={`R$ ${fmtBRL(totalRendimentos)}`}
          tone="positive"
          hint={`tribut R$ ${fmtBRL(rendimentos.tributaveis.total)} + isentos R$ ${fmtBRL(rendimentos.isentos.total)}`}
        />
        <KpiCard
          label="DARFs RV"
          textValue={`R$ ${fmtBRL(rv.totals.totalTaxDue)}`}
          tone={rv.totals.totalTaxDue > 0 ? "negative" : "muted"}
          hint={`lucro R$ ${fmtBRL(rv.totals.grossProfitYear)}`}
        />
        <KpiCard
          label={imposto.recommendation === "completo" ? "Recomendado: Completo" : "Recomendado: Simples"}
          textValue={
            imposto.recommendation === "completo"
              ? `R$ ${fmtBRL(imposto.completo.netDue)}`
              : `R$ ${fmtBRL(imposto.simples.netDue)}`
          }
          tone={(imposto.recommendation === "completo" ? imposto.completo.netDue : imposto.simples.netDue) > 0 ? "negative" : "positive"}
        />
      </div>

      <Panel className="mb-5">
        <PanelHeader
          title={<span className="inline-flex items-center gap-2">Bens e Direitos <Badge tone="navy">31/12/{year}</Badge></span>}
          meta={bens.fxNote ? bens.fxNote : "valores em BRL"}
        />
        <BensTable report={bens} />
      </Panel>

      <Panel className="mb-5">
        <PanelHeader title="Rendimentos" meta={`ano ${year}`} />
        <RendimentosTabs rendimentos={rendimentos} year={year} />
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Renda variável — apuração mensal e DARFs"
          meta={`${rv.swing.filter((m) => m.grossSales > 0).length + rv.dayTrade.filter((m) => m.grossSales > 0).length + rv.fii.filter((m) => m.grossSales > 0).length} meses com operações`}
        />
        <RendaVariavelTable report={rv} />
      </Panel>

      {/* Carnê-leão (read-only) */}
      {carneLeao.length > 0 ? (
        <Panel className="mb-5">
          <PanelHeader
            title="Carnê-leão (DARF 0190 mensal)"
            meta={`${carneLeao.length} registros`}
          />
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-faint-foreground font-mono text-[10px] uppercase tracking-[0.12em]">
                <th className="text-left pb-1 font-medium">Mês</th>
                <th className="text-left pb-1 font-medium">Tipo</th>
                <th className="text-left pb-1 font-medium">Descrição</th>
                <th className="text-right pb-1 font-medium">Bruto</th>
                <th className="text-right pb-1 font-medium">DARF</th>
                <th className="text-left pb-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {carneLeao.map((e) => {
                const m = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][e.month - 1];
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-1.5 font-mono">{m}</td>
                    <td className="py-1.5 text-faint-foreground">{e.kind}</td>
                    <td className="py-1.5 text-foreground">{e.description}</td>
                    <td className="py-1.5 font-mono text-right tabular-nums">R$ {fmtBRL(Number(e.gross_amount))}</td>
                    <td className="py-1.5 font-mono text-right tabular-nums">R$ {fmtBRL(Number(e.tax_due))}</td>
                    <td className="py-1.5">
                      {e.paid_at ? <Badge tone="olive">pago</Badge> : <Badge tone="rust">pendente</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {/* Exterior + Cripto (read-only) */}
      {(exterior.byAsset.length > 0 || crypto.monthly.some((m) => m.grossSales > 0)) ? (
        <Panel className="mb-5">
          <PanelHeader
            title="Aplicações no exterior + cripto"
            meta="Lei 14.754/2023 — 15% anual"
          />
          {exterior.byAsset.length > 0 ? (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge tone="navy">Exterior · {exterior.byAsset.length} ativos</Badge>
                <span className="text-[12px] text-muted-foreground">
                  Lucro R$ {fmtBRL(exterior.totalProfitBRL)} · imposto R$ {fmtBRL(exterior.taxDue)}
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
                  Imposto ano: R$ {fmtBRL(crypto.totalTaxDue)}
                </span>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      <Panel className="mb-5">
        <PanelHeader title="Imposto a pagar / restituição" />
        <ImpostoCompareCard imposto={imposto} />
      </Panel>

      {!settings?.cpf_titular ? (
        <Panel className="border-gold-600/30">
          <p className="text-[13px]">
            <b className="text-foreground">CPF do titular não cadastrado.</b>{" "}
            Solicite ao cliente que preencha em Configurações antes de exportar
            o .DEC.
          </p>
        </Panel>
      ) : null}
    </>
  );
}
