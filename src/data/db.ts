import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  Asset,
  Expense,
  Goal,
  Income,
  Liability,
  NetWorthSnapshot,
} from "@/domain/types";
import { CLASS, LIABILITY_TYPE, type Taxonomy } from "@/domain/taxonomy";

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
  }
}

export const db = new FinancasDB();
