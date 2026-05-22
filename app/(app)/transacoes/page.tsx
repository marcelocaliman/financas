import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { QuickAddTrigger } from "@/components/transactions/quick-add-trigger";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionsFilterBar } from "@/components/transactions/transactions-filter-bar";
import { Pagination } from "@/components/transactions/pagination";
import { ExportButton } from "@/components/transactions/export-button";
import { ImportButton } from "@/components/transactions/import-button";
import { BulkAddButton } from "@/components/transactions/bulk-add-button";
import { listTransactions, monthRange, getMonthlySummary } from "@/services/transactions";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { Money } from "@/components/ui/money";
import type { TransactionKind } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = {
  month?: string;
  kind?: string;
  q?: string;
  page?: string;
};

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const month = params.month;
  const kindFilter = (params.kind ?? "all") as TransactionKind | "all";
  const q = params.q ?? "";
  const page = Math.max(0, parseInt(params.page ?? "0", 10) || 0);
  const pageSize = 40;

  const [{ rows, total }, summary, accounts, categories] = await Promise.all([
    listTransactions({
      month,
      kind: kindFilter,
      search: q || undefined,
      page,
      pageSize,
    }),
    getMonthlySummary(month),
    listAccounts(),
    listCategories(),
  ]);

  const accountsLite = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    currency: a.currency,
  }));
  const categoriesLite = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));

  const { label: monthLabel, from, to } = monthRange(month);
  const monthInputValue = from.slice(0, 7);

  return (
    <>
      <PageHeader
        eyebrow={`Histórico · ${monthLabel}`}
        title={
          <>
            Todas as <em className="not-italic font-display italic text-navy-700">transações</em>
          </>
        }
        subtitle={`${summary.transactionCount} movimento${summary.transactionCount !== 1 ? "s" : ""} esse mês — entre receitas, despesas e transferências internas.`}
        actions={
          <>
            <ExportButton />
            <ImportButton />
            <BulkAddButton accounts={accountsLite} categories={categoriesLite} />
            <QuickAddTrigger />
          </>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Mini label="Entrou" value={summary.income} tone="positive" currency={summary.displayCurrency} />
        <Mini label="Saiu" value={summary.expense} tone="negative" currency={summary.displayCurrency} />
        <Mini
          label="Sobra"
          value={summary.net}
          tone={summary.net >= 0 ? "positive" : "negative"}
          currency={summary.displayCurrency}
        />
      </div>

      <TransactionsFilterBar
        current={kindFilter}
        monthStr={monthInputValue}
        tabs={[
          { value: "all", label: "Todas", count: summary.transactionCount },
          { value: "income", label: "Receitas" },
          { value: "expense", label: "Despesas" },
          { value: "transfer", label: "Transferências" },
        ]}
      />

      <Panel className="!px-0 !py-2">
        {rows.length === 0 ? (
          <EmptyResult monthLabel={monthLabel} hasQuery={!!q} />
        ) : (
          <div className="overflow-x-auto px-7">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground text-left pb-3 pr-4 font-medium">
                    Data
                  </th>
                  <th className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground text-left pb-3 pr-4 font-medium">
                    Descrição
                  </th>
                  <th className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground text-left pb-3 pr-4 font-medium">
                    Categoria
                  </th>
                  <th className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground text-right pb-3 font-medium">
                    Valor
                  </th>
                  <th className="w-9" />
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    accounts={accountsLite}
                    categories={categoriesLite}
                  />
                ))}
              </tbody>
            </table>

            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        )}
      </Panel>

      <p className="text-[10.5px] font-mono text-faint-foreground tracking-[0.06em] mt-4">
        Período: {from} → {to}
      </p>
    </>
  );
}

function Mini({
  label,
  value,
  tone,
  currency,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative";
  currency: "BRL" | "EUR" | "USD";
}) {
  const toneClass =
    value === 0 ? "text-foreground" : tone === "positive" ? "text-olive-700" : "text-rust-600";
  return (
    <div className="rounded-[var(--radius)] bg-surface border border-border px-5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <Money
        value={value}
        currency={currency}
        showComparison
        className={`mt-1.5 text-[20px] tracking-[-0.02em] items-start ${toneClass}`}
        secondaryClassName="text-[11px]"
      />
    </div>
  );
}

function EmptyResult({
  monthLabel,
  hasQuery,
}: {
  monthLabel: string;
  hasQuery: boolean;
}) {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-display text-[20px] tracking-[-0.015em] text-foreground">
        {hasQuery ? "Nada bateu com essa busca." : `Nenhum movimento em ${monthLabel}.`}
      </p>
      <p className="text-[13.5px] text-muted-foreground mt-2 max-w-[400px] mx-auto">
        {hasQuery
          ? "Tenta limpar a busca ou mudar o mês."
          : "Esse mês está em branco. Comece pelo botão Adicionar acima ou use ⌘K."}
      </p>
    </div>
  );
}
