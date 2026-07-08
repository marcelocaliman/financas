import { useMemo, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTaxItems } from "@/hooks/use-irpf";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { repository } from "@/data/dexie-repository";
import { summarizeIncome } from "@/irpf/income";
import { BENS_GROUPS, codeName, isForeignCurrency, CODES_LAYOUT } from "@/irpf/codes";
import { changeFlag, brlValue } from "@/irpf/irpf-csv";
import { nameById } from "@/domain/taxonomy";
import type { TaxItem } from "@/domain/irpf";
import type { Income } from "@/domain/types";

// Documento do Organizador de IRPF pro contador — HTML impresso em PDF (mesmo pipeline do relatório Pro:
// #irpf-report + body.print-irpf + @media print). Em PT (é documento brasileiro). Estilos inline de
// PAPEL (independentes do tema da tela). Agrupado por grupo/código, com as duas colunas de situação, os
// bens no exterior sem R$ calculado, e a folha de avisos.

const INK = "#15171a", MUTED = "#5f646c", FAINT = "#9aa0a8", LINE = "#e4e6ea", POS = "#15976a", AMBER = "#8a6d1f";
const SANS = "Inter, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const fmt = (n?: number) => (n == null ? "—" : "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const numBR = (n?: number) => (n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));

function Kpi({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: "6px", padding: "7px 9px" }}>
      <div style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>{label}</div>
      <div style={{ fontSize: strong ? "13px" : "11.5px", fontWeight: 600, marginTop: "3px", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: "12px", fontWeight: 600, margin: "16px 0 8px", paddingBottom: "3px", borderBottom: `1px solid ${INK}` }}>{children}</h2>;
}
function ItemBlock({ it, year, debt }: { it: TaxItem; year: number; debt?: boolean }) {
  const foreign = isForeignCurrency(it.currency);
  const flag = changeFlag(it);
  const nome = debt ? codeName("", it.code, "debt") : codeName(it.group, it.code);
  // Vendido: coluna de 31/12 do ano-base = 0 POR REGRA; a história da venda vive na discriminação.
  const baseVal = it.disposed ? 0 : brlValue(it, "base");
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: "5px", padding: "7px 9px", marginBottom: "5px", pageBreakInside: "avoid" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "3px" }}>
        <div style={{ fontFamily: MONO, fontSize: "8.5px", color: MUTED }}>
          {debt ? `Código ${it.code}` : `Grupo ${it.group} · Código ${it.code}`}{nome ? ` — ${nome}` : ""}{it.country ? ` · ${it.country}` : ""}
        </div>
        {flag ? <span style={{ fontFamily: MONO, fontSize: "7.5px", fontWeight: 700, color: flag === "VENDIDO" ? AMBER : POS, whiteSpace: "nowrap" }}>• {flag}</span> : null}
      </div>
      <div style={{ fontSize: "10px", marginBottom: "4px" }}>{it.discriminacao || <span style={{ color: FAINT }}>[discriminação a preencher]</span>}</div>
      <div style={{ display: "flex", gap: "18px", fontSize: "9.5px", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
        <span>Situação 31/12/{year - 1}: <b style={{ color: INK }}>{fmt(brlValue(it, "prev"))}</b></span>
        <span>Situação 31/12/{year}: <b style={{ color: INK }}>{fmt(baseVal)}</b></span>
      </div>
      {it.disposed ? (
        <div style={{ fontSize: "8.5px", color: AMBER, marginTop: "3px" }}>
          Bem vendido no ano — situação em 31/12/{year} = R$ 0,00. Apurar ganho de capital (GCAP) no mês da venda; confira com o contador.
        </div>
      ) : foreign ? (
        <div style={{ fontSize: "8.5px", color: AMBER, marginTop: "3px" }}>
          Exterior: {it.currency} {numBR(it.valorAnoBase)} · o R$ é o custo de aquisição pela PTAX da data da compra{it.fxNote ? ` (${it.fxNote})` : ""} — confirme com o contador.
        </div>
      ) : null}
    </div>
  );
}

/** Documento completo — impresso quando o body tem a classe `print-irpf`. No modo separado recebe os
 *  itens/renda JÁ filtrados pelo declarante (e os comuns já divididos) + o nome dele no cabeçalho. */
export function IrpfReport({ year, itemsOverride, incomesOverride, declaranteName }: { year: number; itemsOverride?: TaxItem[]; incomesOverride?: Income[]; declaranteName?: string }) {
  const queriedItems = useTaxItems(year) ?? [];
  const queriedIncomes = useLiveQuery(() => repository.listIncomes()) ?? [];
  const items = itemsOverride ?? queriedItems;
  const incomes = incomesOverride ?? queriedIncomes;
  const tax = useTaxonomy();
  const incomeSummary = useMemo(() => summarizeIncome(incomes, year), [incomes, year]);

  const bens = items.filter((i) => i.kind === "asset");
  const dividas = items.filter((i) => i.kind === "debt").sort((a, b) => a.code.localeCompare(b.code));
  const totalBase = bens.reduce((s, it) => s + (it.disposed ? 0 : brlValue(it, "base") ?? 0), 0);
  const totalPrev = bens.reduce((s, it) => s + (brlValue(it, "prev") ?? 0), 0);
  const totalDiv = dividas.reduce((s, it) => s + (brlValue(it, "base") ?? 0), 0);
  const byGroup = BENS_GROUPS
    .map((g) => ({ group: g.group, name: g.name, list: bens.filter((it) => it.group === g.group).sort((a, b) => a.code.localeCompare(b.code)) }))
    .filter((x) => x.list.length);
  const semGrupo = bens.filter((it) => !BENS_GROUPS.some((g) => g.group === it.group));

  return (
    <div id="irpf-report" className="print-only" style={{ fontFamily: SANS, color: INK, fontSize: "10.5px", lineHeight: 1.4 }}>
      <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: "10px", marginBottom: "14px" }}>
        <div style={{ fontFamily: MONO, fontSize: "8.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>Organizador de IRPF · {CODES_LAYOUT}</div>
        <h1 style={{ fontSize: "19px", margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.02em" }}>Informe para organização do IRPF {year}</h1>
        <div style={{ fontSize: "9.5px", color: MUTED, marginTop: "3px" }}>{declaranteName ? <><b style={{ color: INK }}>Declaração de {declaranteName}</b> · </> : null}Posição em 31/12/{year} · valores em reais (R$){declaranteName ? " · bens comuns pela parte que cabe a esta declaração" : ""}</div>
        <div style={{ marginTop: "8px", padding: "7px 10px", border: `1px solid ${AMBER}`, background: "#fdf6e9", borderRadius: "6px", fontSize: "9px", color: "#6f5514" }}>
          <b>Isto não é a sua declaração.</b> O app organiza — não declara, não envia, não presta consultoria fiscal. Confira TODOS os dados (códigos, valores, CNPJ) com o seu contador. Os códigos mudam a cada exercício.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "6px" }}>
        <Kpi label={`Bens 31/12/${year - 1}`} value={fmt(totalPrev)} />
        <Kpi label={`Bens 31/12/${year}`} value={fmt(totalBase)} strong />
        <Kpi label="Dívidas" value={fmt(totalDiv)} />
        <Kpi label="Patrimônio líquido" value={fmt(totalBase - totalDiv)} />
      </div>
      <div style={{ fontSize: "8px", color: FAINT }}>Totais somam só o R$ informado; bens no exterior sem R$ preenchido ficam de fora do total.</div>

      <SectionTitle>Bens e Direitos</SectionTitle>
      {[...byGroup, ...(semGrupo.length ? [{ group: "", name: "Sem código — completar", list: semGrupo }] : [])].map((grp) => (
        <div key={grp.group || "sem"} style={{ marginBottom: "10px" }}>
          <div style={{ fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em", color: POS, marginBottom: "4px" }}>{grp.group ? `${grp.group} · ${grp.name}` : grp.name}</div>
          {grp.list.map((it) => <ItemBlock key={it.id} it={it} year={year} />)}
        </div>
      ))}
      {bens.length === 0 ? <div style={{ fontSize: "9.5px", color: FAINT }}>Nenhum bem lançado.</div> : null}

      {dividas.length ? (
        <>
          <SectionTitle>Dívidas e Ônus Reais</SectionTitle>
          {dividas.map((it) => <ItemBlock key={it.id} it={it} year={year} debt />)}
        </>
      ) : null}

      {incomeSummary.length ? (
        <>
          <SectionTitle>Rendimentos registrados em {year} (bruto)</SectionTitle>
          <div style={{ fontSize: "9px", color: MUTED, marginBottom: "6px" }}>Resumo do que foi registrado no orçamento. NÃO classificado em ficha (tributável/isento/exclusivo) nem convertido de moeda — a classificação é do contador.</div>
          {incomeSummary.map((r) => (
            <div key={r.categoryId + r.currency} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${LINE}`, padding: "3px 0", fontSize: "10px" }}>
              <span>{nameById(tax.incomeCategories, r.categoryId) || "Sem categoria"}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.currency} {numBR(r.total)}</span>
            </div>
          ))}
        </>
      ) : null}

      <SectionTitle>Atenção (fora do escopo do app — confirme com o contador)</SectionTitle>
      <ul style={{ fontSize: "9px", color: MUTED, margin: 0, paddingLeft: "16px", lineHeight: 1.5 }}>
        <li><b>Bens no exterior:</b> declarados pelo custo de aquisição na cotação (PTAX) da data da compra — não pelo valor de mercado convertido hoje. Pode haver obrigações extras (ex.: DCBE/BCB; Lei 14.754/2023 para aplicações financeiras).</li>
        <li><b>Criptoativos:</b> além de Bens e Direitos, há obrigação acessória mensal (IN RFB 1.888) acima de um piso.</li>
        <li><b>Previdência:</b> VGBL vai em Bens e Direitos (grupo 99); <b>PGBL não</b> (é dedução, ficha de Pagamentos).</li>
        <li><b>Ganho de capital, carnê-leão, come-cotas e o cálculo do imposto</b> estão fora do escopo deste organizador.</li>
      </ul>

      <div style={{ marginTop: "16px", borderTop: `1px solid ${LINE}`, paddingTop: "6px", fontFamily: MONO, fontSize: "8px", color: FAINT, textAlign: "center" }}>
        nossasfinancas.com.br · Organizador de IRPF · Não é declaração oficial · Confirme com seu contador
      </div>
    </div>
  );
}
