import Link from "next/link";
import { AlertCircle, CalendarCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Eyebrow } from "@/components/ui/eyebrow";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { YearCard, type YearCardState } from "@/components/ir/year-card";

export const dynamic = "force-dynamic";

/**
 * Landing IR — lista de anos-base organizada por relevância.
 *
 * Layout:
 *   - Destaque: ano-base atual (em coleta) + anterior (em entrega se prazo aberto)
 *   - Histórico: anos com snapshot ou dados, agrupados em accordion
 *   - Arquivados: escondidos por padrão, accordion separado
 */
export default async function IRPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [
    { data: snapshots },
    { data: settings },
    { data: darfs },
    { data: metadata },
    { data: payments },
    { data: incomes },
    { data: carneLeao },
  ] = await Promise.all([
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
    supabase
      .from("ir_year_metadata")
      .select("year, archived_at, archive_reason"),
    supabase.from("ir_deductible_payments").select("year"),
    supabase.from("ir_other_incomes").select("year"),
    supabase.from("carne_leao_mensal").select("year"),
  ]);

  const now = new Date();
  const currentYearBase = now.getUTCFullYear();
  const previousYearBase = currentYearBase - 1;
  const currentMonth = now.getUTCMonth(); // 0-indexed; 4 = Maio
  const deliveryOpen = currentMonth <= 4;

  const snapshotByYear = new Map<number, { closed_at: string }>();
  for (const s of snapshots ?? []) snapshotByYear.set(s.year, s as { closed_at: string });

  const metaByYear = new Map<number, { archived_at: string | null; archive_reason: string | null }>();
  for (const m of metadata ?? []) metaByYear.set(m.year, m);

  const yearsWithData = new Set<number>();
  yearsWithData.add(currentYearBase);
  yearsWithData.add(previousYearBase);
  for (const s of snapshots ?? []) yearsWithData.add(s.year);
  for (const d of darfs ?? []) yearsWithData.add(d.year);
  for (const m of metadata ?? []) yearsWithData.add(m.year);
  for (const p of payments ?? []) yearsWithData.add(p.year);
  for (const i of incomes ?? []) yearsWithData.add(i.year);
  for (const c of carneLeao ?? []) yearsWithData.add(c.year);

  const yearsWithRealData = new Set<number>();
  for (const s of snapshots ?? []) yearsWithRealData.add(s.year);
  for (const d of darfs ?? []) yearsWithRealData.add(d.year);
  for (const p of payments ?? []) yearsWithRealData.add(p.year);
  for (const i of incomes ?? []) yearsWithRealData.add(i.year);
  for (const c of carneLeao ?? []) yearsWithRealData.add(c.year);

  const pendingDarfs = (darfs ?? []).filter(
    (d) => Number(d.tax_due) > 0 && !d.paid_at,
  );
  const totalPending = pendingDarfs.reduce((s, d) => s + Number(d.tax_due), 0);

  type YearInfo = {
    year: number;
    state: YearCardState;
    closedAt: string | null;
    hasSnapshot: boolean;
    hasAnyData: boolean;
    archiveReason: string | null;
  };
  const classify = (year: number): YearInfo => {
    const snap = snapshotByYear.get(year);
    const meta = metaByYear.get(year);
    const hasSnapshot = !!snap;
    const hasAnyData = yearsWithRealData.has(year);
    if (meta?.archived_at) {
      return {
        year,
        state: "archived",
        closedAt: snap?.closed_at ?? null,
        hasSnapshot,
        hasAnyData,
        archiveReason: meta.archive_reason,
      };
    }
    if (year === currentYearBase) {
      return { year, state: "current", closedAt: null, hasSnapshot, hasAnyData, archiveReason: null };
    }
    if (year === previousYearBase) {
      return {
        year,
        state: hasSnapshot ? "closed" : (deliveryOpen ? "previous_open" : "previous_closed"),
        closedAt: snap?.closed_at ?? null,
        hasSnapshot,
        hasAnyData,
        archiveReason: null,
      };
    }
    return {
      year,
      state: hasSnapshot ? "closed" : "historical",
      closedAt: snap?.closed_at ?? null,
      hasSnapshot,
      hasAnyData,
      archiveReason: null,
    };
  };

  const allYears = Array.from(yearsWithData).sort((a, b) => b - a);
  const classified = allYears.map(classify);

  const featured = classified.filter((c) => c.state === "current" || c.state === "previous_open");
  const history = classified.filter(
    (c) =>
      c.state === "closed" ||
      c.state === "previous_closed" ||
      c.state === "historical",
  );
  const archived = classified.filter((c) => c.state === "archived");

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
        actions={
          <Link
            href="/declarantes"
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-3 py-2 text-[13px] text-foreground hover:bg-bone-100/60 dark:hover:bg-ink-800/60 transition-colors"
          >
            <Users className="w-3.5 h-3.5" strokeWidth={1.7} />
            Declarantes
          </Link>
        }
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

      {/* Banner "feche o ano em breve" — out a dez do ano corrente */}
      {currentMonth >= 9 && !snapshotByYear.get(currentYearBase) ? (
        <Panel className="mb-5 border-navy-700/30">
          <div className="flex items-start gap-3">
            <CalendarCheck className="w-5 h-5 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />
            <div className="flex-1">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-1">
                Fim do ano-base se aproximando
              </div>
              <p className="text-[13px] leading-snug">
                Quando virar {currentYearBase + 1}, o app vai usar o snapshot 31/12/{currentYearBase} como
                &quot;situação anterior&quot; das declarações de {currentYearBase + 1}. Em janeiro/{currentYearBase + 1},
                feche o ano em <code>/ir/{currentYearBase}</code> pra travar os saldos.
              </p>
            </div>
            <Link
              href={`/ir/${currentYearBase}`}
              className="text-navy-700 dark:text-navy-300 text-[13px] shrink-0 self-center hover:underline"
            >
              Ir pra {currentYearBase} →
            </Link>
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

      {/* DESTAQUE — atual + anterior c/ prazo aberto */}
      <div className="grid gap-4 mb-6">
        {featured.map((c) => (
          <YearCard
            key={c.year}
            year={c.year}
            state={c.state}
            hasSnapshot={c.hasSnapshot}
            closedAt={c.closedAt}
            hasAnyData={c.hasAnyData}
            archiveReason={c.archiveReason}
          />
        ))}
      </div>

      {/* HISTÓRICO — accordion */}
      {history.length > 0 ? (
        <details className="mb-4">
          <summary className="cursor-pointer mb-3 flex items-center gap-2">
            <Eyebrow>Histórico · {history.length} {history.length === 1 ? "ano" : "anos"}</Eyebrow>
            <span className="text-[12px] text-faint-foreground">(clique pra expandir)</span>
          </summary>
          <div className="grid gap-4 pt-2">
            {history.map((c) => (
              <YearCard
                key={c.year}
                year={c.year}
                state={c.state}
                hasSnapshot={c.hasSnapshot}
                closedAt={c.closedAt}
                hasAnyData={c.hasAnyData}
                archiveReason={c.archiveReason}
              />
            ))}
          </div>
        </details>
      ) : null}

      {/* ARQUIVADOS */}
      {archived.length > 0 ? (
        <details className="mb-4">
          <summary className="cursor-pointer mb-3 flex items-center gap-2">
            <Eyebrow>Arquivados · {archived.length}</Eyebrow>
            <span className="text-[12px] text-faint-foreground">(escondidos do dia-a-dia)</span>
          </summary>
          <div className="grid gap-4 pt-2">
            {archived.map((c) => (
              <YearCard
                key={c.year}
                year={c.year}
                state={c.state}
                hasSnapshot={c.hasSnapshot}
                closedAt={c.closedAt}
                hasAnyData={c.hasAnyData}
                archiveReason={c.archiveReason}
              />
            ))}
          </div>
        </details>
      ) : null}

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
            <b className="text-foreground">Carryover:</b> &quot;Situação em 31/12 do ano anterior&quot;
            é pré-preenchida do snapshot do ano anterior — você só ajusta o atual.
          </li>
          <li>
            <b className="text-foreground">Exportar:</b> gera arquivo .DEC pra importar no
            Programa IRPF + relatório legível pra copiar/colar nas seções.
          </li>
          <li>
            <b className="text-foreground">Gestão de anos:</b> arquive anos entregues
            externamente (some da lista, dados preservados); exclua tudo de um ano com
            confirmação dupla se precisar limpar.
          </li>
        </ul>
      </Panel>
    </>
  );
}
