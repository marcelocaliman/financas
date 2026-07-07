import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload } from "lucide-react";
import { actions } from "@/data/actions";
import { statementResidual } from "@/finance/statement";
import { parseCSV, statementTemplateCSV } from "@/finance/statement-csv";
import { parseAmount } from "@/money/parse";
import { matchCategory, EXPENSE_OTHER, type TaxonomyItem } from "@/domain/taxonomy";
import { convert, CURRENCIES, type Currency, type RateTable } from "@/money/currency";
import type { Expense } from "@/domain/types";
import { Money } from "@/components/common/money";
import { DataGrid, type GridColumn, type SelectOption } from "@/components/grid/data-grid";
import { useViewer } from "@/store/viewer";
import { cn } from "@/lib/utils";

const BTN =
  "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11.5px] text-muted hover:text-text hover:bg-card-hover transition-colors";

/** Lê um campo do registro CSV aceitando sinônimos PT/EN (o cabeçalho vem localizado). */
function pick(rec: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) if (rec[a] != null && rec[a] !== "") return rec[a];
  return "";
}

/**
 * Painel expandido de uma FATURA: mini-tabela dos itens (filhos, via parentId) + "não discriminado"
 * (fatura − Σ itens) + baixar modelo / importar CSV em lote. Adicionar/importar aqui já vincula o
 * item à fatura, então NUNCA soma em dobro no total do mês. Tudo client-side (o E2EE não muda).
 */
export function StatementDetail({
  fatura,
  items,
  categories,
  people,
  rates,
}: {
  fatura: Expense;
  /** Itens já vinculados a esta fatura (filhos), reativos ao live-query do pai. */
  items: Expense[];
  /** Categorias de gasto elegíveis (sem a própria "Cartão de Crédito"). */
  categories: TaxonomyItem[];
  /** Integrantes da casa — coluna "Pessoa" e coluna do modelo só surgem com 2+. */
  people: TaxonomyItem[];
  rates: RateTable;
}) {
  const { t } = useTranslation();
  const viewerMode = useViewer((s) => s.viewerMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const residual = statementResidual(fatura, items, rates);
  const itemized = fatura.amount - residual;
  const hasPeople = people.length >= 2;

  // Quanto cada pessoa gastou NESTA fatura (só os itens detalhados; o "não discriminado" fica de fora,
  // aparece na linha própria). Itens sem pessoa somam em "Compartilhado". Na moeda da fatura.
  const perPerson = (() => {
    if (!hasPeople || items.length === 0) return [];
    const by = new Map<string, number>();
    for (const it of items) {
      const k = it.personId ?? "";
      by.set(k, (by.get(k) ?? 0) + convert(it.amount, it.currency, fatura.currency, rates));
    }
    const rows = people.filter((p) => (by.get(p.id) ?? 0) > 0.005).map((p) => ({ id: p.id, name: p.name, value: by.get(p.id)! }));
    const shared = by.get("") ?? 0;
    if (shared > 0.005) rows.push({ id: "", name: t("orcamento.personShared"), value: shared });
    return rows.sort((a, b) => b.value - a.value);
  })();

  const cols: GridColumn<Expense>[] = [
    { key: "categoryId", type: "select", header: t("orcamento.category"), width: "minmax(130px,1.2fr)", placeholder: t("orcamento.categoryPlaceholder"), options: categories.map((c): SelectOption => ({ value: c.id, label: c.name })) },
    { key: "name", type: "text", header: t("orcamento.detail"), width: "minmax(140px,1.6fr)", placeholder: t("orcamento.detailPlaceholder") },
    ...(hasPeople ? [{ key: "personId", type: "select" as const, header: t("orcamento.person"), width: "minmax(96px,0.9fr)", optional: true, options: people.map((p): SelectOption => ({ value: p.id, label: p.name })) }] : []),
    { key: "amount", type: "money", header: t("orcamento.monthly"), width: "minmax(130px,1fr)", align: "right", currencyKey: "currency" },
  ];
  const newChild = (): Expense => ({ id: crypto.randomUUID(), month: fatura.month, categoryId: "", name: "", currency: fatura.currency, amount: 0, parentId: fatura.id });

  const downloadTemplate = () => {
    const header = [t("orcamento.category"), t("orcamento.detail"), t("orcamento.amount"), t("common.currency")];
    if (hasPeople) header.push(t("orcamento.person"));
    const cats = categories.map((c) => c.name);
    const pers = people.map((p) => p.name);
    const examples = [
      ["Mercado", "Compras do mês", "450,00"],
      ["Transporte", "Uber / combustível", "180,00"],
      ["Saúde", "Farmácia", "90,00"],
    ];
    const rows = examples.map((ex, i) => {
      const row = [cats[i] ?? ex[0], ex[1], ex[2], fatura.currency];
      if (hasPeople) row.push(pers[i % pers.length] ?? "");
      return row;
    });
    const csv = statementTemplateCSV(header, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo-fatura-${fatura.month}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar o mesmo arquivo
    if (!file) return;
    setMsg(null);
    try {
      const recs = parseCSV(await file.text());
      const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
      const byPerson = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id]));
      const toAdd: Expense[] = [];
      let skipped = 0;
      for (const r of recs) {
        const amount = parseAmount(pick(r, "valor", "amount", "value"));
        if (amount == null || amount <= 0) {
          skipped++;
          continue;
        }
        const catRaw = pick(r, "categoria", "category").trim();
        const categoryId = byName.get(catRaw.toLowerCase()) ?? matchCategory(catRaw, categories) ?? EXPENSE_OTHER;
        const cur = pick(r, "moeda", "currency").trim().toUpperCase();
        const currency = (CURRENCIES as readonly string[]).includes(cur) ? (cur as Currency) : fatura.currency;
        const name = pick(r, "detalhe", "detail", "nome", "name", "descrição", "description").trim();
        const personRaw = pick(r, "pessoa", "person", "portador").trim().toLowerCase();
        const personId = personRaw ? byPerson.get(personRaw) : undefined;
        toAdd.push({ id: crypto.randomUUID(), month: fatura.month, categoryId, name, currency, amount, parentId: fatura.id, ...(personId ? { personId } : {}) });
      }
      if (toAdd.length === 0) {
        setMsg(t("orcamento.importNone"));
        return;
      }
      await actions.importExpenses(toAdd);
      setMsg(skipped > 0 ? t("orcamento.importDoneSkipped", { n: toAdd.length, s: skipped }) : t("orcamento.importDone", { n: toAdd.length }));
    } catch {
      setMsg(t("orcamento.importError"));
    }
  };

  return (
    <div className="space-y-3">
      {/* Dica em LARGURA CHEIA (1–2 linhas em vez de 3 estreitas). */}
      <p className="text-[11px] leading-relaxed text-faint">{t("orcamento.statementHint")}</p>

      {/* Linha ACIMA da tabela: totais por pessoa à ESQUERDA · ações (modelo/importar) à DIREITA. */}
      {perPerson.length > 0 || !viewerMode ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[10px] border border-border bg-card2/40 px-3.5 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1.5">
            {perPerson.length > 0 ? (
              <>
                <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-faint">{t("orcamento.tabPeople")}</span>
                {perPerson.map((b) => (
                  <span key={b.id || "shared"} className="inline-flex items-baseline gap-1.5 text-[12.5px]">
                    <span className="text-muted">{b.name}</span>
                    <Money value={b.value} currency={fatura.currency} className="font-semibold tabular text-text" />
                  </span>
                ))}
              </>
            ) : null}
          </div>
          {!viewerMode ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={downloadTemplate} className={BTN}>
                <Download size={13} /> {t("orcamento.downloadTemplate")}
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className={BTN}>
                <Upload size={13} /> {t("orcamento.importCsv")}
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e)} />
            </div>
          ) : null}
        </div>
      ) : null}
      {msg ? <p className="text-[11px] text-muted">{msg}</p> : null}

      <DataGrid<Expense>
        columns={cols}
        rows={items}
        blank={newChild}
        isComplete={(r) => r.categoryId.length > 0 && r.amount > 0}
        onCommit={(r) => void actions.putExpense({ ...r, parentId: fatura.id })}
        onDelete={(id) => void actions.removeExpense(id)}
        addPlaceholder={t("orcamento.addStatementItem")}
        total={<Money value={itemized} currency={fatura.currency} />}
      />
      <div className="flex items-center justify-between gap-3 px-1 pt-0.5 text-[12px]">
        <span className="text-muted">{t("orcamento.statementResidual")}</span>
        <Money value={residual} currency={fatura.currency} className={cn("font-medium", residual < -0.005 && "text-neg")} />
      </div>
      {residual < -0.005 ? <p className="px-1 text-[11px] text-neg">{t("orcamento.overItemized")}</p> : null}
    </div>
  );
}
