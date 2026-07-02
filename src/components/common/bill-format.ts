import type { BillStatus } from "@/domain/bills";

const LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

/** Cor por urgência do vencimento — FONTE ÚNICA (lista do Orçamento + tooltip do menu). */
export const BILL_STATUS_TONE: Record<BillStatus, string> = {
  overdue: "text-neg",
  today: "text-neg",
  soon: "text-text",
  later: "text-faint",
};

/** "AAAA-MM-DD" → "02 jul" no idioma corrente. */
export function dueDateLabel(dueDate: string, lang: string): string {
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE[lang] ?? "pt-BR", { day: "2-digit", month: "short" });
}

type Translate = (key: string, opts?: { n: number }) => string;
/** "atrasada há Xd" / "vence hoje" / "em Xd". */
export function daysLabel(t: Translate, status: BillStatus, daysUntil: number): string {
  return status === "overdue"
    ? t("orcamento.overdueDays", { n: -daysUntil })
    : status === "today"
      ? t("orcamento.dueToday")
      : t("orcamento.dueInDays", { n: daysUntil });
}
