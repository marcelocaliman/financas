import { useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection } from "@/store/projection";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useBudget } from "@/hooks/use-budget";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { CLASS, nameById } from "@/domain/taxonomy";
import { fireNumber } from "@/finance/fire";
import { upcomingBills } from "@/domain/bills";

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function shiftReportMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function reportMonthLabel(month: string, lang: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { month: "long", year: "numeric" });
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateLabel(iso: string, lang: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { day: "2-digit", month: "short" });
}

// Cores fixas (impressão em papel/PDF, independente do tema da tela).
const INK = "#15171a";
const MUTED = "#5f646c";
const FAINT = "#9aa0a8";
const LINE = "#e4e6ea";
const POS = "#15976a";
const NEG = "#c0473d";

/** Relatório mensal imprimível/PDF. Invisível na tela (.print-only); via portal no body. */
export function MonthlyReport({ month }: { month: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const proj = useProjection();
  const tax = useTaxonomy();
  const pat = usePatrimonio();
  const bud = useBudget();

  const v = useMemo(() => {
    if (!pat || !bud) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const totalAssets = pat.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = pat.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const netWorth = totalAssets - totalLiab;

    const monthExp = bud.expenses.filter((e) => e.month === month);
    const monthInc = bud.incomes.filter((i) => i.month === month);
    const totalExp = monthExp.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = monthInc.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const saldo = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? (saldo / totalInc) * 100 : null;

    const byCatMap = new Map<string, number>();
    for (const e of monthExp) byCatMap.set(e.categoryId, (byCatMap.get(e.categoryId) ?? 0) + conv(e.amount, e.currency));
    const byCat = [...byCatMap.entries()]
      .map(([id, value]) => ({ name: nameById(tax.expenseCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);

    const caixa = pat.assets.filter((a) => a.classId === CLASS.caixa).reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const reserveMonths = totalExp > 0 ? caixa / totalExp : null;

    const expMonths = new Set(bud.expenses.map((e) => e.month));
    const annualExp = expMonths.size > 0
      ? (proj.annualExpensesOverride ?? (bud.expenses.reduce((s, e) => s + conv(e.amount, e.currency), 0) / expMonths.size) * 12)
      : 0;
    const target = fireNumber(annualExp, proj.withdrawalRate);
    const fireProgress = annualExp > 0 && Number.isFinite(target) && target > 0 ? (netWorth / target) * 100 : null;

    const bills = upcomingBills(bud.expenses, todayISO()).slice(0, 10).map((b) => ({
      name: b.name || nameById(tax.expenseCategories, b.categoryId) || t("orcamento.uncategorized"),
      dueDate: b.dueDate,
      value: conv(b.amount, b.currency),
    }));

    return { totalAssets, totalLiab, netWorth, totalExp, totalInc, saldo, savingsRate, byCat, reserveMonths, fireProgress, bills };
  }, [pat, bud, disp, rates, tax, proj, month, t]);

  const money = (n: number) => formatMoney(n, disp);

  const node = (
    <div id="monthly-report" className="print-only">
      <div style={{ background: "#fff", color: INK, fontFamily: "Inter, system-ui, sans-serif", maxWidth: "760px", margin: "0 auto", fontSize: "13px", lineHeight: 1.5 }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: "10px", marginBottom: "18px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em" }}>{t("report.appName")}</div>
            <div style={{ color: MUTED, fontSize: "12px", marginTop: "2px" }}>
              {t("report.title")} · <span style={{ textTransform: "capitalize" }}>{reportMonthLabel(month, lang)}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", color: FAINT, fontSize: "11px" }}>
            {t("report.generatedOn", { date: dateLabel(todayISO(), lang) })}
            <div>{disp}</div>
          </div>
        </div>

        {!v ? (
          <div style={{ color: MUTED }}>—</div>
        ) : (
          <>
            {/* Métricas-chave */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "22px" }}>
              <Metric label={t("report.netWorth")} value={money(v.netWorth)} />
              <Metric label={t("orcamento.income")} value={money(v.totalInc)} tone={POS} />
              <Metric label={t("orcamento.expenses")} value={money(v.totalExp)} tone={NEG} />
              <Metric label={t("orcamento.balance")} value={money(v.saldo)} tone={v.saldo >= 0 ? POS : NEG} />
            </div>

            {/* Patrimônio + indicadores */}
            <Section title={t("nav.patrimonio")}>
              <Row label={t("patrimonio.assets")} value={money(v.totalAssets)} />
              <Row label={t("patrimonio.liabilities")} value={money(v.totalLiab)} />
              <Row label={t("patrimonio.netWorth")} value={money(v.netWorth)} strong />
              {v.reserveMonths != null ? <Row label={t("dashboard.reserve")} value={t("dashboard.reserveMonths", { n: v.reserveMonths.toFixed(1) })} /> : null}
              {v.savingsRate != null ? <Row label={t("dashboard.savingsRate")} value={`${Math.round(v.savingsRate)}%`} /> : null}
              {v.fireProgress != null ? <Row label={t("fire.title")} value={`${Math.round(v.fireProgress)}%`} /> : null}
            </Section>

            {/* Gastos por categoria */}
            {v.byCat.length > 0 ? (
              <Section title={`${t("nav.orcamento")} · ${t("orcamento.byCategory")}`}>
                {v.byCat.map((c) => (
                  <Row key={c.name} label={c.name} value={money(c.value)} />
                ))}
                <Row label={t("orcamento.expenses")} value={money(v.totalExp)} strong />
              </Section>
            ) : null}

            {/* Contas a pagar */}
            {v.bills.length > 0 ? (
              <Section title={t("orcamento.upcomingBills")}>
                {v.bills.map((b, i) => (
                  <Row key={i} label={`${b.name} · ${dateLabel(b.dueDate, lang)}`} value={money(b.value)} />
                ))}
              </Section>
            ) : null}

            <div style={{ marginTop: "24px", paddingTop: "10px", borderTop: `1px solid ${LINE}`, color: FAINT, fontSize: "10.5px", display: "flex", justifyContent: "space-between" }}>
              <span>nossasfinancas.com.br</span>
              <span>{t("report.footer")}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: "8px", padding: "10px 12px" }}>
      <div style={{ fontSize: "9.5px", textTransform: "uppercase", letterSpacing: "0.08em", color: FAINT }}>{label}</div>
      <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "3px", color: tone ?? INK, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "18px", breakInside: "avoid" }}>
      <div style={{ fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, fontWeight: 600, marginBottom: "6px" }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "4px 0", borderTop: `1px solid ${LINE}` }}>
      <span style={{ color: strong ? INK : MUTED, fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ color: INK, fontWeight: strong ? 700 : 500, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
