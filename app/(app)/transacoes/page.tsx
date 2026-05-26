import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { QuickAddTrigger } from "@/components/transactions/quick-add-trigger";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionCard } from "@/components/transactions/transaction-card";
import { TransactionsFilterBar } from "@/components/transactions/transactions-filter-bar";
import { ActiveFiltersChips } from "@/components/transactions/active-filters-chips";
import { SavedViews } from "@/components/transactions/saved-views";
import { Pagination } from "@/components/transactions/pagination";
import { ExportButton } from "@/components/transactions/export-button";
import { ImportButton } from "@/components/transactions/import-button";
import { BulkAddButton } from "@/components/transactions/bulk-add-button";
import { TransactionsKeyboardNav } from "@/components/transactions/transactions-keyboard-nav";
import {
  listTransactions,
  monthRange,
  getMonthlySummary,
  listDistinctPortadores,
  getMonthlyCardSpending,
} from "@/services/transactions";
import { formatDateNumeric } from "@/lib/utils/format";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import type { Transaction } from "@/services/transactions";
import type { TransactionKind } from "@/types/database";
import { formatDateFull } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

function currentMonthISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  return fmt.format(new Date());
}

type Params = {
  month?: string;
  kind?: string;
  q?: string;
  tag?: string;
  categoryId?: string;
  accountId?: string;
  page?: string;
  showHistorical?: string;
  showTransferPairs?: string;
};

const KIND_TAB_LABEL: Record<string, string> = {
  income: "Receitas",
  expense: "Despesas",
  transfer: "Transferências",
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
  const tag = params.tag ?? "";
  const categoryId = params.categoryId ?? "";
  const accountId = params.accountId ?? "";
  const page = Math.max(0, parseInt(params.page ?? "0", 10) || 0);
  const pageSize = 40;
  const showTransferPairs = params.showTransferPairs === "1";

  const { from: curFrom } = monthRange(month);
  // Mês anterior pra Δ
  const [yy, mm] = curFrom.slice(0, 7).split("-").map(Number);
  const prevYear = mm - 1 === 0 ? yy - 1 : yy;
  const prevKey = `${prevYear}-${String(mm - 1 || 12).padStart(2, "0")}`;

  // Default "Históricas: ON" quando navega pra mês anterior ao corrente.
  // Faz sentido: mês passado provavelmente só tem históricas (lançamentos
  // retroativos pra IR). Pra mês corrente/futuro, mantém OFF.
  const todayMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const isPastMonth = curFrom.slice(0, 7) < todayMonth;
  const showHistorical =
    params.showHistorical === "1"
      ? true
      : params.showHistorical === "0"
        ? false
        : isPastMonth; // default true se mês passado, false caso contrário

  const [{ rows, total }, summary, prevSummary, accounts, categories, portadores, cardSpending] =
    await Promise.all([
      listTransactions({
        month,
        kind: kindFilter,
        search: q || undefined,
        tag: tag || undefined,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        page,
        pageSize,
        showHistorical,
        showTransferPairs,
      }),
      getMonthlySummary(month),
      getMonthlySummary(prevKey),
      listAccounts(),
      listCategories(),
      listDistinctPortadores(),
      getMonthlyCardSpending(month),
    ]);

  const cardIds = accounts.filter((a) => a.type === "credit_card").map((a) => a.id);
  const firstCardId = cardIds[0] ?? null;
  const hasCardSpending = cardSpending.total > 0;

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

  // Δ pct vs mês anterior — só faz sentido sem filtro de kind aplicado
  const incomeDelta =
    prevSummary.income > 0 ? summary.income / prevSummary.income - 1 : null;
  const expenseDelta =
    prevSummary.expense > 0 ? summary.expense / prevSummary.expense - 1 : null;
  const netDelta = summary.net - prevSummary.net;

  // Agrupa transações por dia
  const grouped: Array<{ date: string; rows: Transaction[]; total: number }> = [];
  for (const tx of rows) {
    const day = tx.date;
    let group = grouped[grouped.length - 1];
    if (!group || group.date !== day) {
      group = { date: day, rows: [], total: 0 };
      grouped.push(group);
    }
    group.rows.push(tx);
    // Total do dia em moeda nativa da transação — fins informativos
    const amt = Number(tx.amount);
    if (tx.kind === "income") group.total += amt;
    else if (tx.kind === "expense") group.total -= amt;
  }

  return (
    <>
      <PageHeader
        eyebrow={`${monthLabel} · ${from} → ${to}`}
        title={
          <>
            Todas as <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">transações</em>
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

      <div
        className={cn(
          "grid grid-cols-2 gap-3 mb-6",
          hasCardSpending ? "sm:grid-cols-4" : "sm:grid-cols-3",
        )}
      >
        <KpiCard
          label="Entrou"
          value={summary.income}
          tone="positive"
          deltaPct={incomeDelta}
        />
        <KpiCard
          label="Saiu"
          value={summary.expense}
          tone="negative"
          deltaPct={expenseDelta}
          invertDeltaColor
        />
        {hasCardSpending ? (
          <Link
            href={
              firstCardId
                ? `/transacoes?accountId=${firstCardId}${month ? `&month=${month}` : ""}`
                : "/contas"
            }
            className="block"
          >
            <KpiCard
              label="No cartão"
              value={cardSpending.total}
              tone="muted"
              hint={
                cardSpending.nextDueDate
                  ? `vence ${formatDateNumeric(cardSpending.nextDueDate)}`
                  : `${cardSpending.txCount} compra${cardSpending.txCount === 1 ? "" : "s"}`
              }
            />
          </Link>
        ) : null}
        <KpiCard
          label="Sobra"
          value={summary.net}
          tone={summary.net >= 0 ? "positive" : "negative"}
          deltaAbs={netDelta}
          className={hasCardSpending ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-1"}
        />
      </div>

      <TransactionsFilterBar
        current={kindFilter}
        monthStr={monthInputValue}
        monthLabel={monthLabel}
        isCurrentMonth={monthInputValue === currentMonthISO()}
        historicalShownByDefault={isPastMonth}
        categories={categoriesLite}
        portadores={portadores}
        tabs={[
          { value: "all", label: "Todas", count: summary.transactionCount },
          { value: "income", label: "Receitas" },
          { value: "expense", label: "Despesas" },
          { value: "transfer", label: "Transferências" },
        ]}
      />

      <ActiveFiltersChips
        kindLabel={kindFilter !== "all" ? KIND_TAB_LABEL[kindFilter] : null}
        queryLabel={q || null}
        tagLabel={tag || null}
        categoryLabel={
          categoryId === "__none__"
            ? "Sem categoria"
            : categoryId
              ? categories.find((c) => c.id === categoryId)?.name ?? null
              : null
        }
      />

      <SavedViews />

      <Panel className="!px-0 !py-2">
        {rows.length === 0 ? (
          <EmptyResult
            monthLabel={monthLabel}
            hasQuery={!!q}
            isPastMonth={isPastMonth}
            historicalShown={showHistorical}
          />
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="hidden lg:block overflow-x-auto px-7">
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
                  {grouped.map((group) => (
                    <Fragment key={group.date}>
                      <tr className="bg-surface-muted/50">
                        <td
                          colSpan={5}
                          className="px-1 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium"
                        >
                          {formatDateFull(group.date)}
                          <span className="ml-2 text-muted-foreground normal-case tracking-normal">
                            · {group.rows.length} lançamento{group.rows.length === 1 ? "" : "s"}
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((tx) => (
                        <TransactionRow
                          key={tx.id}
                          tx={tx}
                          accounts={accountsLite}
                          categories={categoriesLite}
                        />
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageSize={pageSize} total={total} />
            </div>

            {/* Mobile: cards agrupados por dia */}
            <div className="lg:hidden">
              {grouped.map((group) => (
                <div key={group.date}>
                  <div className="px-4 py-2 bg-surface-muted/50 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium sticky top-0 z-10">
                    {formatDateFull(group.date)}
                    <span className="ml-2 text-muted-foreground normal-case tracking-normal">
                      · {group.rows.length}
                    </span>
                  </div>
                  {group.rows.map((tx) => (
                    <TransactionCard
                      key={tx.id}
                      tx={tx}
                      accounts={accountsLite}
                      categories={categoriesLite}
                    />
                  ))}
                </div>
              ))}
              <div className="px-4">
                <Pagination page={page} pageSize={pageSize} total={total} />
              </div>
            </div>
          </>
        )}
      </Panel>

      <TransactionsKeyboardNav currentKind={kindFilter} />
    </>
  );
}

function EmptyResult({
  monthLabel,
  hasQuery,
  isPastMonth = false,
  historicalShown = false,
}: {
  monthLabel: string;
  hasQuery: boolean;
  isPastMonth?: boolean;
  historicalShown?: boolean;
}) {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-display text-[20px] tracking-[-0.015em] text-foreground">
        {hasQuery ? "Nada bateu com essa busca." : `Nenhum movimento em ${monthLabel}.`}
      </p>
      <p className="text-[13.5px] text-muted-foreground mt-2 max-w-[480px] mx-auto leading-relaxed">
        {hasQuery
          ? "Tenta limpar a busca ou mudar o mês."
          : isPastMonth && !historicalShown
            ? (
              <>
                Esse mês está em branco. Se você cadastrou recorrências de salário/despesa
                com início em meses anteriores, ligue o toggle{" "}
                <b className="text-foreground">&quot;Históricas: ON&quot;</b> acima pra ver os
                lançamentos retroativos pra IR.
              </>
            )
            : "Esse mês está em branco. Comece pelo botão Adicionar acima ou use ⌘K."}
      </p>
    </div>
  );
}
