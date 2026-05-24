import Link from "next/link";
import { FileText, ArrowRight, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

export const dynamic = "force-dynamic";

/**
 * Landing IR — lista de anos-base.
 * O ano-base do IRPF é o ano CIVIL anterior (ex.: IRPF 2026 declara ano-base 2025).
 * A app sugere o ano-base padrão = ano corrente − 1.
 */
export default async function IRPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [{ data: snapshots }, { data: settings }, { data: darfs }] = await Promise.all([
    supabase
      .from("ir_year_snapshots")
      .select("year, closed_at, totals")
      .order("year", { ascending: false }),
    supabase
      .from("ir_settings")
      .select("*")
      .maybeSingle(),
    supabase
      .from("ir_darfs")
      .select("year, tax_due, paid_at")
      .order("year", { ascending: false }),
  ]);

  const now = new Date();
  const currentYearBase = now.getUTCFullYear() - 1;

  // Anos pra mostrar: ano-base atual + qualquer ano com snapshot ou DARFs
  const yearsWithData = new Set<number>();
  yearsWithData.add(currentYearBase);
  for (const s of snapshots ?? []) yearsWithData.add(s.year);
  for (const d of darfs ?? []) yearsWithData.add(d.year);
  const years = Array.from(yearsWithData).sort((a, b) => b - a);

  const snapshotByYear = new Map<number, { year: number; closed_at: string; totals: unknown }>();
  for (const s of snapshots ?? []) snapshotByYear.set(s.year, s);

  // DARFs pendentes (não pagos) — alerta global
  const pendingDarfs = (darfs ?? []).filter(
    (d) => Number(d.tax_due) > 0 && !d.paid_at,
  );
  const totalPending = pendingDarfs.reduce((s, d) => s + Number(d.tax_due), 0);

  return (
    <>
      <PageHeader
        eyebrow="Imposto de renda · pessoa física"
        title={
          <>
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">IRPF</em>
          </>
        }
        subtitle="Prepara os dados pra declaração anual. Gera relatório nas seções do programa IRPF + arquivo .DEC pra importar. NÃO substitui a transmissão oficial — ainda é via Programa IRPF."
      />

      {pendingDarfs.length > 0 ? (
        <Panel className="mb-5 border-rust-600/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rust-600 shrink-0 mt-0.5" strokeWidth={1.7} />
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-rust-600 font-medium mb-1">
                DARFs pendentes
              </div>
              <p className="text-[13px]">
                {pendingDarfs.length} DARF{pendingDarfs.length === 1 ? "" : "s"} de renda variável aguardando pagamento, totalizando{" "}
                <span className="font-mono">R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {!settings?.cpf_titular ? (
        <Panel className="mb-5 border-gold-600/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gold-700 dark:text-gold-500 font-medium mb-1">
                Configure antes de exportar
              </div>
              <p className="text-[13px]">
                Sem CPF cadastrado, o arquivo .DEC não pode ser gerado. Configure agora.
              </p>
            </div>
            <Link
              href={`/ir/${currentYearBase}/configuracoes`}
              className="text-navy-700 dark:text-navy-300 text-[13px] shrink-0"
            >
              Configurar →
            </Link>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4">
        {years.map((y) => {
          const snap = snapshotByYear.get(y);
          const isCurrent = y === currentYearBase;
          return (
            <Link
              key={y}
              href={`/ir/${y}`}
              className="block group"
            >
              <Panel className="!p-6 hover:border-navy-700/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-[10px] bg-navy-700/10 grid place-items-center shrink-0">
                    <FileText className="w-5 h-5 text-navy-700 dark:text-navy-300" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-display text-[22px] tracking-[-0.015em] text-foreground">
                        Ano-base {y}
                      </span>
                      <span className="font-mono text-[11.5px] text-faint-foreground">
                        · IRPF/{y + 1}
                      </span>
                      {isCurrent ? <Badge tone="navy">Atual</Badge> : null}
                      {snap ? (
                        <Badge tone="olive">
                          Fechado em {new Date(snap.closed_at).toLocaleDateString("pt-BR")}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Aberto</Badge>
                      )}
                    </div>
                    <p className="text-[13px] text-muted-foreground mb-3">
                      {snap
                        ? "Snapshot salvo. Pode rever, recalcular DARFs e re-exportar a qualquer momento."
                        : isCurrent
                          ? "Em construção. Revise bens, rendimentos, dependentes e gere DARFs."
                          : "Preparar declaração desse ano-base."}
                    </p>
                    <div className="text-navy-700 dark:text-navy-300 text-[13px] inline-flex items-center gap-1">
                      Abrir
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
                    </div>
                  </div>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>

      <Panel className="mt-6 border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Como funciona
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground">
          <li>
            <b className="text-foreground">Bens e Direitos:</b> agrega contas, investimentos
            e bens físicos com código Receita inferido automaticamente.
          </li>
          <li>
            <b className="text-foreground">Rendimentos:</b> separa tributáveis (salário,
            aluguel), isentos (LCI/LCA, dividendos) e exclusivos na fonte (CDB).
          </li>
          <li>
            <b className="text-foreground">Renda variável:</b> calcula DARFs mensais swing
            (15%, isenção R$ 20k) e day trade (20%), com compensação de prejuízos.
          </li>
          <li>
            <b className="text-foreground">Carryover:</b> "Situação em 31/12 do ano anterior"
            é pré-preenchida do snapshot do ano anterior — você só ajusta o atual.
          </li>
          <li>
            <b className="text-foreground">Exportar:</b> gera arquivo .DEC pra importar no
            Programa IRPF + relatório legível pra copiar/colar nas seções.
          </li>
        </ul>
      </Panel>
    </>
  );
}
