import type { Currency } from "@/types/database";
import type { ActivityLogEntry } from "@/services/activity-log";

const ACTION_VERB: Record<string, string> = {
  insert: "Criou",
  update: "Editou",
  delete: "Excluiu",
};

const TABLE_NOUN: Record<string, string> = {
  transactions: "transação",
  accounts: "conta",
  investments: "investimento",
  debts: "dívida",
  physical_assets: "bem",
  goals: "meta",
  recurring_rules: "recorrência",
  ir_deductible_payments: "dedução IR",
};

export type ActivityDescription = {
  title: string;
  /** Valor cru pra ser exibido em destaque (não pré-formatado). */
  amount?: number;
  /** Direção do dinheiro — define sinal/cor do valor. */
  direction?: "in" | "out" | "neutral";
  currency?: Currency;
};

/**
 * Transforma uma entrada do activity_log num título humano + o VALOR em destaque.
 * O valor é a informação principal pro usuário ("o que gastei e quanto"), então
 * sai cru (number) + direção pra a UI renderizar grande, com sinal e cor.
 */
export function describeActivity(e: ActivityLogEntry): ActivityDescription {
  const d = (e.new_data ?? e.old_data ?? {}) as Record<string, unknown>;
  const verb = ACTION_VERB[e.action] ?? e.action;
  const num = (v: unknown) =>
    v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const str = (v: unknown) => (typeof v === "string" && v ? v : "—");
  const dirOf = (kind: unknown): "in" | "out" | "neutral" =>
    kind === "income" ? "in" : kind === "expense" ? "out" : "neutral";
  const currency = (typeof d.currency === "string" ? d.currency : "BRL") as Currency;

  switch (e.table_name) {
    case "transactions": {
      const kind = d.kind;
      const noun =
        kind === "income" ? "receita" : kind === "expense" ? "despesa" : "transferência";
      return {
        title: `${verb} ${noun} "${str(d.description)}"`,
        amount: num(d.amount_account ?? d.amount),
        direction: dirOf(kind),
        currency,
      };
    }
    case "accounts":
      return { title: `${verb} conta "${str(d.name)}"` };
    case "investments":
      return {
        title: `${verb} investimento "${str(d.ticker ?? d.name)}"`,
        amount: num(d.current_balance),
        direction: "neutral",
        currency,
      };
    case "debts":
      return {
        title: `${verb} dívida "${str(d.description)}"`,
        amount: num(d.current_balance),
        direction: "neutral",
        currency,
      };
    case "physical_assets":
      return { title: `${verb} bem "${str(d.name)}"` };
    case "goals":
      return { title: `${verb} meta "${str(d.name)}"` };
    case "recurring_rules":
      return {
        title: `${verb} recorrência "${str(d.description)}"`,
        amount: num(d.amount),
        direction: dirOf(d.kind),
        currency,
      };
    case "ir_deductible_payments":
      return {
        title: `${verb} dedução IR "${str(d.description)}"`,
        amount: num(d.amount),
        direction: "neutral",
        currency,
      };
    default:
      return { title: `${verb} ${TABLE_NOUN[e.table_name] ?? e.table_name}` };
  }
}
