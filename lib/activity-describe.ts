import { formatMoney } from "@/lib/utils/format";
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

/**
 * Transforma uma entrada do activity_log num texto humano + detalhe (valor).
 * Lê do snapshot new_data (ou old_data, no caso de exclusão).
 */
export function describeActivity(e: ActivityLogEntry): { title: string; detail?: string } {
  const d = (e.new_data ?? e.old_data ?? {}) as Record<string, unknown>;
  const verb = ACTION_VERB[e.action] ?? e.action;
  const money = (v: unknown) =>
    v != null && v !== "" ? formatMoney(Number(v)) : undefined;
  const str = (v: unknown) => (typeof v === "string" && v ? v : "—");

  switch (e.table_name) {
    case "transactions": {
      const kind = d.kind;
      const noun =
        kind === "income" ? "receita" : kind === "expense" ? "despesa" : "transferência";
      return {
        title: `${verb} ${noun} "${str(d.description)}"`,
        detail: money(d.amount_account ?? d.amount),
      };
    }
    case "accounts":
      return { title: `${verb} conta "${str(d.name)}"` };
    case "investments":
      return {
        title: `${verb} investimento "${str(d.ticker ?? d.name)}"`,
        detail: money(d.current_balance),
      };
    case "debts":
      return {
        title: `${verb} dívida "${str(d.description)}"`,
        detail: money(d.current_balance),
      };
    case "physical_assets":
      return { title: `${verb} bem "${str(d.name)}"` };
    case "goals":
      return { title: `${verb} meta "${str(d.name)}"` };
    case "recurring_rules":
      return {
        title: `${verb} recorrência "${str(d.description)}"`,
        detail: money(d.amount),
      };
    case "ir_deductible_payments":
      return {
        title: `${verb} dedução IR "${str(d.description)}"`,
        detail: money(d.amount),
      };
    default:
      return { title: `${verb} ${TABLE_NOUN[e.table_name] ?? e.table_name}` };
  }
}
