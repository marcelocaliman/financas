import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  Asset,
  Dividend,
  Expense,
  Goal,
  Income,
  Liability,
  NetWorthSnapshot,
} from "@/domain/types";
import {
  CLASS,
  DEFAULT_TAXONOMY,
  EXPENSE_OTHER,
  INCOME_OTHER,
  LIABILITY_TYPE,
  matchCategory,
  type Taxonomy,
} from "@/domain/taxonomy";

/** Banco local (IndexedDB via Dexie). Cópia de trabalho local-first. */
export class FinancasDB extends Dexie {
  assets!: Table<Asset, string>;
  liabilities!: Table<Liability, string>;
  expenses!: Table<Expense, string>;
  incomes!: Table<Income, string>;
  netWorthSnapshots!: Table<NetWorthSnapshot, string>;
  taxonomy!: Table<Taxonomy, string>;
  goals!: Table<Goal, string>;
  settings!: Table<AppSettings, string>;
  dividends!: Table<Dividend, string>;

  constructor() {
    super("financas");
    this.version(1).stores({
      assets: "id, type, currency",
      expenses: "id, currency",
      incomes: "id, currency",
      netWorthSnapshots: "id, month",
    });
    // v2: passivos (Patrimônio). Tabelas da v1 são preservadas.
    this.version(2).stores({
      liabilities: "id, type, currency",
    });
    // v3: modelo de categorias — classId/typeId + taxonomia editável.
    // Migra o type legado (investment/property/cash · loan/card/mortgage/other) sem perder dados.
    this.version(3)
      .stores({
        assets: "id, classId, currency",
        liabilities: "id, typeId, currency",
        taxonomy: "id",
      })
      .upgrade(async (tx) => {
        const classMap: Record<string, string> = {
          investment: CLASS.rendaFixa,
          property: CLASS.imoveis,
          cash: CLASS.caixa,
        };
        await tx
          .table("assets")
          .toCollection()
          .modify((a: Record<string, unknown>) => {
            a.classId = classMap[a.type as string] ?? CLASS.outros;
            delete a.type;
          });

        const liabMap: Record<string, string> = {
          mortgage: LIABILITY_TYPE.financiamentoImobiliario,
          card: LIABILITY_TYPE.cartaoCredito,
          loan: LIABILITY_TYPE.emprestimoPessoal,
          other: LIABILITY_TYPE.outrasDividas,
        };
        await tx
          .table("liabilities")
          .toCollection()
          .modify((l: Record<string, unknown>) => {
            l.typeId = liabMap[l.type as string] ?? LIABILITY_TYPE.outrasDividas;
            delete l.type;
          });
      });
    // v4: Objetivos (goals) + Configurações sincronizadas (settings). Tabelas novas.
    this.version(4).stores({
      goals: "id, currency",
      settings: "id",
    });
    // v5: Orçamento por categoria. Migra o `name` legado → categoryId (casando com as
    // categorias-padrão) e MANTÉM o name como detalhe livre.
    this.version(5)
      .stores({
        expenses: "id, categoryId, currency",
        incomes: "id, categoryId, currency",
      })
      .upgrade(async (tx) => {
        await tx
          .table("expenses")
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            e.categoryId = matchCategory(String(e.name ?? ""), DEFAULT_TAXONOMY.expenseCategories) ?? EXPENSE_OTHER;
          });
        await tx
          .table("incomes")
          .toCollection()
          .modify((i: Record<string, unknown>) => {
            i.categoryId = matchCategory(String(i.name ?? ""), DEFAULT_TAXONOMY.incomeCategories) ?? INCOME_OTHER;
          });
      });
    // v6: Proventos/dividendos (renda passiva). Tabela nova.
    this.version(6).stores({
      dividends: "id, month, currency",
    });
    // v7: Orçamento por MÊS (visão mensal/histórica). Carimba o que já existe no mês corrente.
    this.version(7)
      .stores({
        expenses: "id, categoryId, currency, month",
        incomes: "id, categoryId, currency, month",
      })
      .upgrade(async (tx) => {
        const d = new Date();
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        await tx
          .table("expenses")
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            if (!e.month) e.month = month;
          });
        await tx
          .table("incomes")
          .toCollection()
          .modify((i: Record<string, unknown>) => {
            if (!i.month) i.month = month;
          });
      });
  }
}

export const db = new FinancasDB();
