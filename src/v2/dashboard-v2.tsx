import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight, Receipt, CalendarClock, Wallet } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useVault } from "@/vault/vault-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { categoryColors } from "@/money/composition";
import { nameById } from "@/domain/taxonomy";
import { upcomingBills } from "@/domain/bills";
import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";

const ACCENT = "#15976a";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };
function monthLabel(m: string, lang: string, opts: Intl.DateTimeFormatOptions = { month: "short" }): string {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", opts).replace(".", "");
}
function dateLabel(iso: string, lang: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

const cardCls = "rounded-[22px] bg-card border border-border shadow-[var(--shadow-card)]";
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(cardCls, className)}>{children}</div>;
}
function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{children}</h3>
      {right}
    </div>
  );
}

export function DashboardV2() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const email = useVault((s) => s.email);
  const tax = useTaxonomy();
  const { data } = useDashboardData();
  const CAT = categoryColors("light");

  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const totalAssets = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const netWorth = totalAssets - totalLiab;

    const mo = currentMonth();
    const monthExp = data.expenses.filter((e) => e.month === mo);
    const monthInc = data.incomes.filter((i) => i.month === mo);
    const totalExp = monthExp.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = monthInc.reduce((s, i) => s + conv(i.amount, i.currency), 0);

    const byCat = new Map<string, number>();
    for (const e of monthExp) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + conv(e.amount, e.currency));
    const expByCat = [...byCat.entries()]
      .map(([id, value]) => ({ id, name: nameById(tax.expenseCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);

    const incByCat = new Map<string, number>();
    for (const i of monthInc) incByCat.set(i.categoryId, (incByCat.get(i.categoryId) ?? 0) + conv(i.amount, i.currency));
    const receipts = [...incByCat.entries()]
      .map(([id, value]) => ({ id, name: nameById(tax.incomeCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);

    const trend = [...data.snapshots]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((s) => ({ m: s.month, v: conv(s.amount, s.currency) }));
    const last = trend.at(-1);
    const prev = trend.at(-2);
    const nwChange = last && prev && prev.v !== 0 ? ((last.v - prev.v) / prev.v) * 100 : null;

    const bills = upcomingBills(data.expenses, todayISO()).slice(0, 5).map((b) => ({
      id: b.id,
      name: b.name || nameById(tax.expenseCategories, b.categoryId) || t("orcamento.uncategorized"),
      due: dateLabel(b.dueDate, lang),
      value: conv(b.amount, b.currency),
    }));
    const monthBills = monthExp.filter((e) => e.dueDay != null);
    const paid = monthBills.filter((e) => e.paid).length;

    // Transações recentes: gastos + receitas dos meses mais recentes.
    const tx = [
      ...data.expenses.map((e) => ({ id: e.id, kind: "out" as const, name: e.name || nameById(tax.expenseCategories, e.categoryId) || t("orcamento.uncategorized"), month: e.month, value: conv(e.amount, e.currency) })),
      ...data.incomes.map((i) => ({ id: i.id, kind: "in" as const, name: i.name || nameById(tax.incomeCategories, i.categoryId) || t("orcamento.uncategorized"), month: i.month, value: conv(i.amount, i.currency) })),
    ]
      .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
      .slice(0, 7);

    const isEmpty = data.assets.length === 0 && data.liabilities.length === 0 && data.expenses.length === 0 && data.incomes.length === 0 && data.snapshots.length === 0;

    return { netWorth, totalAssets, totalLiab, totalExp, totalInc, saldo: totalInc - totalExp, expByCat, receipts, trend, nwChange, bills, billsTotal: monthBills.length, paid, tx, isEmpty };
  }, [data, disp, rates, tax, t, lang]);

  if (!v) return <div className="h-[60vh] rounded-[22px] bg-card/50 border border-border animate-pulse" />;
  if (v.isEmpty) return <EmptyV2 />;

  const money = (n: number) => formatMoney(n, disp);
  const donutTotal = v.expByCat.reduce((s, e) => s + e.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Coluna 1 */}
      <div className="space-y-4 lg:col-span-1">
        {/* Cartão herói — patrimônio líquido */}
        <Card className="relative overflow-hidden p-6 text-white" >
          <div className="absolute inset-0 bg-gradient-to-br from-[#1f2440] via-[#222a52] to-[#15976a] opacity-95" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-white/70">{t("dashboard.netWorth")}</span>
              <Wallet size={18} className="text-white/70" />
            </div>
            <div className="mt-3 text-[clamp(1.9rem,4vw,2.5rem)] font-semibold tracking-[-0.03em] tabular">
              <Money value={v.netWorth} currency={disp} />
            </div>
            {v.nwChange != null ? (
              <div className={cn("mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium", v.nwChange >= 0 ? "text-[#7ef0bd]" : "text-[#ffb4bd]")}>
                {v.nwChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {(v.nwChange >= 0 ? "+" : "") + v.nwChange.toFixed(1)}% <span className="text-white/50">{t("dashboard.vsMonth")}</span>
              </div>
            ) : null}
            <div className="mt-7 text-[13px] tracking-[0.18em] text-white/80 font-medium uppercase truncate">{(email ?? "").split("@")[0]}</div>
          </div>
        </Card>

        {/* Fluxo do mês */}
        <Card className="p-6">
          <Title>{t("v2.cashflow")}</Title>
          <div className="grid grid-cols-2 gap-3">
            <FlowStat kind="in" label={t("orcamento.income")} value={<Money value={v.totalInc} currency={disp} />} />
            <FlowStat kind="out" label={t("orcamento.expenses")} value={<Money value={v.totalExp} currency={disp} options={{ signDisplay: "never" }} />} />
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-[12.5px] text-muted">{t("orcamento.balance")}</span>
            <Money value={v.saldo} currency={disp} className={cn("text-[16px] font-semibold tabular", v.saldo >= 0 ? "text-accent" : "text-neg")} />
          </div>
        </Card>

        {/* Donut de gastos por categoria */}
        {v.expByCat.length > 0 ? (
          <Card className="p-6">
            <Title>{t("dashboard.byCategory")}</Title>
            <div className="flex items-center gap-4">
              <div className="relative w-[120px] h-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={v.expByCat} dataKey="value" nameKey="name" innerRadius={42} outerRadius={58} paddingAngle={2} stroke="none">
                      {v.expByCat.map((e, i) => (
                        <Cell key={e.id} fill={CAT[i % CAT.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => money(Number(val))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-float)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <Money value={donutTotal} currency={disp} className="text-[13px] font-semibold tabular" options={{ notation: "compact" }} />
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {v.expByCat.slice(0, 5).map((e, i) => (
                  <div key={e.id} className="flex items-center justify-between text-[12.5px] gap-3">
                    <span className="flex items-center gap-2 text-muted truncate">
                      <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: CAT[i % CAT.length] }} />
                      {e.name}
                    </span>
                    <Money value={e.value} currency={disp} className="font-medium tabular" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}
      </div>

      {/* Coluna 2 */}
      <div className="space-y-4 lg:col-span-1">
        {/* Evolução do patrimônio */}
        <Card className="p-6">
          <Title right={v.nwChange != null ? <span className={cn("text-[13px] font-semibold tabular", v.nwChange >= 0 ? "text-accent" : "text-neg")}>{(v.nwChange >= 0 ? "+" : "") + v.nwChange.toFixed(1)}%</span> : undefined}>
            {t("dashboard.netWorthTrend")}
          </Title>
          {v.trend.length >= 2 ? (
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={v.trend} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                  <defs>
                    <linearGradient id="v2nw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip formatter={(val) => money(Number(val))} labelFormatter={(m) => monthLabel(String(m), lang, { month: "short", year: "2-digit" })} contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-float)" }} />
                  <Area type="monotone" dataKey="v" stroke={ACCENT} strokeWidth={2.5} fill="url(#v2nw)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] grid place-items-center text-[12.5px] text-faint">{t("v2.noTrend")}</div>
          )}
        </Card>

        {/* Transações recentes */}
        <Card className="p-6">
          <Title>{t("v2.transactions")}</Title>
          <div className="divide-y divide-[var(--grid-line)]">
            {v.tx.map((tx) => (
              <div key={tx.kind + tx.id} className="flex items-center gap-3 py-2.5">
                <span className={cn("grid place-items-center w-8 h-8 rounded-[10px] shrink-0", tx.kind === "in" ? "bg-accent-soft text-accent" : "bg-[var(--neg-soft)] text-neg")}>
                  {tx.kind === "in" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate">{tx.name}</div>
                  <div className="text-[11px] text-faint capitalize">{monthLabel(tx.month, lang, { month: "short", year: "2-digit" })}</div>
                </div>
                <Money value={tx.value} currency={disp} className={cn("text-[13px] font-medium tabular shrink-0", tx.kind === "in" ? "text-accent" : "text-text")} options={{ signDisplay: "never" }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Coluna 3 */}
      <div className="space-y-4 lg:col-span-1">
        {/* Contas a pagar (progresso) */}
        <Card className="p-6">
          <Title>{t("v2.payableAccounts")}</Title>
          <p className="text-[12px] text-muted -mt-2 mb-4">{t("v2.payableHint")}</p>
          {v.billsTotal > 0 ? (
            <>
              <div className="text-[15px] font-semibold tabular mb-2">{t("v2.paidOf", { paid: v.paid, total: v.billsTotal })}</div>
              <div className="h-2.5 rounded-full bg-card2 overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${v.billsTotal > 0 ? (v.paid / v.billsTotal) * 100 : 0}%` }} />
              </div>
            </>
          ) : (
            <p className="text-[12.5px] text-faint">{t("v2.noBills")}</p>
          )}
        </Card>

        {/* Receitas */}
        {v.receipts.length > 0 ? (
          <Card className="p-6">
            <Title>{t("v2.receipts")}</Title>
            <div className="space-y-1">
              {v.receipts.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  <span className="grid place-items-center w-9 h-9 rounded-[12px] bg-card2 text-accent shrink-0">
                    <ArrowUpRight size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Money value={r.value} currency={disp} className="text-[14px] font-semibold tabular block" />
                    <div className="text-[11.5px] text-faint truncate">{r.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* A pagar (próximos vencimentos) */}
        {v.bills.length > 0 ? (
          <Card className="p-6">
            <Title>{t("orcamento.upcomingBills")}</Title>
            <div className="space-y-1">
              {v.bills.map((b) => (
                <div key={b.id} className="flex items-center gap-3 py-2">
                  <span className="grid place-items-center w-9 h-9 rounded-[12px] bg-card2 text-muted shrink-0">
                    <Receipt size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Money value={b.value} currency={disp} className="text-[14px] font-semibold tabular block" options={{ signDisplay: "never" }} />
                    <div className="text-[11.5px] text-faint truncate">{b.name}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-faint shrink-0">
                    <CalendarClock size={13} />
                    {b.due}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function FlowStat({ kind, label, value }: { kind: "in" | "out"; label: string; value: ReactNode }) {
  return (
    <div className="rounded-[14px] bg-card2 p-3.5">
      <span className={cn("inline-grid place-items-center w-7 h-7 rounded-[9px] mb-2", kind === "in" ? "bg-accent-soft text-accent" : "bg-[var(--neg-soft)] text-neg")}>
        {kind === "in" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
      </span>
      <div className="text-[15px] font-semibold tabular">{value}</div>
      <div className="text-[11.5px] text-faint mt-0.5">{label}</div>
    </div>
  );
}

function EmptyV2() {
  const { t } = useTranslation();
  return (
    <div className={cn(cardCls, "p-12 grid place-items-center text-center")}>
      <div className="grid place-items-center w-12 h-12 rounded-2xl bg-accent-soft text-accent mb-5">
        <Wallet size={22} />
      </div>
      <div className="text-[22px] font-semibold tracking-[-0.02em]">{t("dashboard.empty")}</div>
      <p className="text-[13.5px] text-muted mt-2 max-w-sm">{t("dashboard.emptyDesc")}</p>
    </div>
  );
}
