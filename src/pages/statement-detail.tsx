import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload } from "lucide-react";
import { actions } from "@/data/actions";
import { statementResidual } from "@/finance/statement";
import { parseCSV, statementTemplateCSV } from "@/finance/statement-csv";
import { parseAmount } from "@/money/parse";
import { matchCategory, EXPENSE_OTHER, type TaxonomyItem } from "@/domain/taxonomy";
import { CURRENCIES, type Currency, type RateTable } from "@/money/currency";
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
  rates,
}: {
  fatura: Expense;
  /** Itens já vinculados a esta fatura (filhos), reativos ao live-query do pai. */
  items: Expense[];
  /** Categorias de gasto elegíveis (sem a própria "Cartão de Crédito"). */
  categories: TaxonomyItem[];
  rates: RateTable;
}) {
  const { t } = useTranslation();
  const viewerMode = useViewer((s) => s.viewerMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const residual = statementResidual(fatura, items, rates);
  const itemized = fatura.amount - residual;

  const cols: GridColumn<Expense>[] = [
    { key: "categoryId", type: "select", header: t("orcamento.category"), width: "minmax(130px,1.2fr)", placeholder: t("orcamento.categoryPlaceholder"), options: categories.map((c): SelectOption => ({ value: c.id, label: c.name })) },
    { key: "name", type: "text", header: t("orcamento.detail"), width: "minmax(140px,1.6fr)", placeholder: t("orcamento.detailPlaceholder") },
    { key: "amount", type: "money", header: t("orcamento.monthly"), width: "minmax(130px,1fr)", align: "right", currencyKey: "currency" },
  ];
  const newChild = (): Expense => ({ id: crypto.randomUUID(), month: fatura.month, categoryId: "", name: "", currency: fatura.currency, amount: 0, parentId: fatura.id });

  const downloadTemplate = () => {
    const header = [t("orcamento.category"), t("orcamento.detail"), t("orcamento.amount"), t("common.currency")];
    const csv = statementTemplateCSV(categories.map((c) => c.name), fatura.currency, header);
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
        toAdd.push({ id: crypto.randomUUID(), month: fatura.month, categoryId, name, currency, amount, parentId: fatura.id });
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-[62ch] text-[11px] leading-relaxed text-faint">{t("orcamento.statementHint")}</p>
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
      {msg ? <p className="px-1 text-[11px] text-muted">{msg}</p> : null}
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
