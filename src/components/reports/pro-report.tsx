import { useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useBudget } from "@/hooks/use-budget";
import { useHistorico } from "@/hooks/use-historico";
import { useObjetivos } from "@/hooks/use-objetivos";
import { useDividends } from "@/hooks/use-dividends";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useFireTarget } from "@/hooks/use-fire-target";
import { useLiberdade } from "@/hooks/use-liberdade";
import { useProjection } from "@/store/projection";
import { convert, formatMoney, compactMoney, type Currency } from "@/money/currency";
import { currencyBreakdown } from "@/money/composition";
import { projectionSeries } from "@/finance/projection";
import { nameById, CLASS } from "@/domain/taxonomy";

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

// Cores fixas (papel/PDF, independem do tema da tela).
const INK = "#15171a";
const MUTED = "#5f646c";
const FAINT = "#9aa0a8";
const LINE = "#e4e6ea";
const POS = "#15976a";
const NEG = "#c0473d";
// Rampa coesa verde→cinza p/ classes/alocação (espelha categoryColors, em HEX fixos).
const RAMP = ["#15976A", "#2E9E73", "#5B6A74", "#878E98", "#A6ACB5", "#6B7280", "#3A4046", "#9AA6B0"];
const CUR_RAMP: Record<Currency, string> = { BRL: "#15976A", EUR: "#6B7280", USD: "#878E98", GBP: "#52525B" };

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function dateLabel(iso: string, lang: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function monthLabel(month: string, lang: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { month: "short", year: "2-digit" });
}

/** Relatório Pro completo — imprimível/PDF, 100% no cliente (E2EE-safe). Invisível na
 *  tela; via portal no body. Impresso quando o body tem a classe `print-pro`. */
export function ProReport() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const tax = useTaxonomy();
  const pat = usePatrimonio();
  const bud = useBudget();
  const hist = useHistorico();
  const goals = useObjetivos();
  const divs = useDividends();
  const fire = useFireTarget();
  const lib = useLiberdade();
  const proj = useProjection();

  const v = useMemo(() => {
    if (!pat || !bud) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const month = currentMonth();

    // Patrimônio
    const totalAssets = pat.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = pat.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const netWorth = totalAssets - totalLiab;

    // Composição por classe
    const byClassMap = new Map<string, number>();
    for (const a of pat.assets) byClassMap.set(a.classId, (byClassMap.get(a.classId) ?? 0) + conv(a.amount, a.currency));
    const byClass = [...byClassMap.entries()]
      .map(([id, value]) => ({ name: nameById(tax.assetClasses, id) || id, value }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((c, i) => ({ ...c, color: RAMP[i % RAMP.length], pct: totalAssets > 0 ? (c.value / totalAssets) * 100 : 0 }));

    // Composição por moeda
    const byCur = currencyBreakdown(pat.assets, disp, rates);

    // Histórico (evolução do patrimônio)
    const snaps = (hist ?? [])
      .slice()
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((s) => ({ month: s.month, value: conv(s.amount, s.currency), contribution: s.contribution != null ? conv(s.contribution, s.currency) : null }));
    const histSeries = snaps.map((s) => s.value);
    const recent = snaps.slice(-8).map((s, i, arr) => ({
      month: s.month,
      value: s.value,
      delta: i > 0 ? s.value - arr[i - 1].value : null,
      contribution: s.contribution,
    }));

    // Orçamento (mês atual)
    const monthExp = bud.expenses.filter((e) => e.month === month);
    const monthInc = bud.incomes.filter((iv) => iv.month === month);
    const totalExp = monthExp.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = monthInc.reduce((s, iv) => s + conv(iv.amount, iv.currency), 0);
    const saldo = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? (saldo / totalInc) * 100 : null;
    const expByCatMap = new Map<string, number>();
    for (const e of monthExp) expByCatMap.set(e.categoryId, (expByCatMap.get(e.categoryId) ?? 0) + conv(e.amount, e.currency));
    const expByCat = [...expByCatMap.entries()]
      .map(([id, value]) => ({ name: nameById(tax.expenseCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);

    const caixa = pat.assets.filter((a) => a.classId === CLASS.caixa).reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const reserveMonths = totalExp > 0 ? caixa / totalExp : null;

    // Renda passiva: dividendos (12m) + aluguel/passiva (do FIRE)
    const cutoff = (() => {
      const [y, m] = month.split("-").map(Number);
      const d = new Date(y, m - 1 - 11, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    const divs12 = (divs ?? []).filter((d) => d.month >= cutoff).reduce((s, d) => s + conv(d.amount, d.currency), 0);
    const passiveAnnual = fire?.passiveAnnual ?? 0;

    // Projeção (3 cenários sobre o patrimônio investível)
    const initial = (proj.initialOverride ?? fire?.eligibleWealth ?? netWorth) || 0;
    const years = proj.years;
    const mk = (annualReturnPct: number, monthly: number) =>
      projectionSeries({ initial, monthlyContribution: monthly, annualReturn: annualReturnPct / 100, annualInflation: proj.annualInflation / 100, years });
    const sc = proj.scenarios;
    const pSeries = mk(sc.pessimistic.annualReturn, sc.pessimistic.monthly);
    const bSeries = mk(sc.base.annualReturn, sc.base.monthly);
    const oSeries = mk(sc.optimistic.annualReturn, sc.optimistic.monthly);
    const yearMarks = [5, 10, 15, 20, 25, 30].filter((y) => y <= years && y > 0);
    if (!yearMarks.includes(years)) yearMarks.push(years);

    // Objetivos
    const goalRows = (goals ?? [])
      .map((g) => {
        const target = conv(g.target, g.currency);
        const current = conv(g.current, g.currency);
        return { name: g.name, target, current, pct: target > 0 ? Math.min(100, (current / target) * 100) : 0, deadline: g.deadline };
      })
      .filter((g) => g.target > 0);

    return {
      totalAssets, totalLiab, netWorth, byClass, byCur,
      histSeries, recent,
      totalExp, totalInc, saldo, savingsRate, expByCat, reserveMonths,
      divs12, passiveAnnual,
      proj: { initial, years, pSeries, bSeries, oSeries, yearMarks, inflation: proj.annualInflation },
      goalRows,
    };
  }, [pat, bud, hist, goals, divs, fire, disp, rates, tax, proj, t]);

  const money = (n: number) => formatMoney(n, disp);

  const node = (
    <div id="pro-report" className="print-only">
      <div style={{ background: "#fff", color: INK, fontFamily: "Inter, system-ui, sans-serif", maxWidth: "760px", margin: "0 auto", fontSize: "13px", lineHeight: 1.5 }}>
        {/* Capa / cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: "10px", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-0.02em" }}>{t("report.appName")}</div>
            <div style={{ color: MUTED, fontSize: "12px", marginTop: "2px" }}>{t("report.proTitle")}</div>
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
            {/* Resumo (métricas-herói) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "22px" }}>
              <Metric label={t("report.netWorth")} value={money(v.netWorth)} big />
              <Metric label={t("report.eligibleWealth")} value={money(fire?.eligibleWealth ?? 0)} />
              <Metric label={t("fire.title")} value={lib && lib.ready ? `${Math.round(lib.freedomPct)}%` : "—"} tone={POS} />
              <Metric label={t("report.savingsRate")} value={v.savingsRate != null ? `${Math.round(v.savingsRate)}%` : "—"} tone={v.savingsRate != null && v.savingsRate >= 0 ? POS : NEG} />
            </div>

            {/* Patrimônio + composição */}
            <Section title={t("nav.patrimonio")}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px", alignItems: "start" }}>
                <div>
                  <Row label={t("patrimonio.assets")} value={money(v.totalAssets)} />
                  <Row label={t("patrimonio.liabilities")} value={money(v.totalLiab)} />
                  <Row label={t("patrimonio.netWorth")} value={money(v.netWorth)} strong />
                  {v.reserveMonths != null ? <Row label={t("dashboard.reserve")} value={t("dashboard.reserveMonths", { n: v.reserveMonths.toFixed(1) })} /> : null}
                  <div style={{ marginTop: "10px" }}>
                    <Caption>{t("report.byCurrency")}</Caption>
                    {v.byCur.map((c) => (
                      <BarRow key={c.currency} label={c.currency} value={`${money(c.value)} · ${c.pct}%`} pct={c.pct} color={CUR_RAMP[c.currency]} />
                    ))}
                  </div>
                </div>
                <div>
                  <Caption>{t("report.composition")}</Caption>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <Donut slices={v.byClass.map((c) => ({ value: c.value, color: c.color }))} size={104} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {v.byClass.slice(0, 6).map((c) => (
                        <LegendRow key={c.name} color={c.color} label={c.name} value={`${Math.round(c.pct)}%`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Evolução do patrimônio */}
            {v.histSeries.length >= 2 ? (
              <Section title={t("report.evolution")}>
                <AreaChart data={v.histSeries} />
                <div style={{ marginTop: "8px" }}>
                  <HeadRow cols={[t("report.month"), t("report.value"), t("report.variation"), t("report.contribution")]} />
                  {v.recent.map((r) => (
                    <DataRow
                      key={r.month}
                      cols={[
                        monthLabel(r.month, lang),
                        money(r.value),
                        r.delta != null ? <span style={{ color: r.delta >= 0 ? POS : NEG }}>{r.delta >= 0 ? "+" : ""}{compactMoney(r.delta, disp)}</span> : "—",
                        r.contribution != null ? compactMoney(r.contribution, disp) : "—",
                      ]}
                    />
                  ))}
                </div>
              </Section>
            ) : null}

            {/* Orçamento do mês */}
            <Section title={`${t("nav.orcamento")} · ${monthLabel(currentMonth(), lang)}`}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "10px" }}>
                <Metric label={t("orcamento.income")} value={money(v.totalInc)} tone={POS} />
                <Metric label={t("orcamento.expenses")} value={money(v.totalExp)} tone={NEG} />
                <Metric label={t("orcamento.balance")} value={money(v.saldo)} tone={v.saldo >= 0 ? POS : NEG} />
              </div>
              {v.expByCat.length > 0 ? (
                <>
                  <Caption>{t("orcamento.byCategory")}</Caption>
                  {v.expByCat.slice(0, 8).map((c) => (
                    <BarRow key={c.name} label={c.name} value={money(c.value)} pct={v.totalExp > 0 ? (c.value / v.totalExp) * 100 : 0} color={NEG} />
                  ))}
                </>
              ) : null}
            </Section>

            {/* Renda passiva */}
            {(v.divs12 > 0 || v.passiveAnnual > 0) ? (
              <Section title={t("report.passiveIncome")}>
                <Row label={t("report.dividends")} value={money(v.divs12)} />
                {v.passiveAnnual > 0 ? <Row label={t("report.rent")} value={money(v.passiveAnnual)} /> : null}
                <Row label={t("report.passiveTotal")} value={money(v.divs12 + v.passiveAnnual)} strong />
              </Section>
            ) : null}

            {/* Independência financeira */}
            {lib && lib.ready ? (
              <Section title={t("report.independence")} breakBefore>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
                  <div>
                    <Row label={t("report.independenceNumber")} value={money(lib.independenceNumber)} strong />
                    <Row label={t("report.eligibleWealth")} value={money(lib.eligibleWealth)} />
                    <Row label={t("report.freedom")} value={`${Math.round(lib.freedomPct)}%`} />
                    <Row label={t("report.coverage")} value={`${Math.round(lib.coverage)}%`} />
                  </div>
                  <div>
                    <Row label={t("report.safeMonthly")} value={money(lib.safeMonthly)} />
                    {lib.yearsOfFreedom != null ? <Row label={t("report.yearsOfFreedom")} value={`${lib.yearsOfFreedom.toFixed(1)}`} /> : null}
                    {lib.arrival ? <Row label={t("report.eta")} value={lib.arrival.label} /> : null}
                    {lib.reached ? <Row label={t("report.status")} value={t("liberdade.reached")} /> : null}
                  </div>
                </div>
              </Section>
            ) : null}

            {/* Projeção (3 cenários) */}
            <Section title={`${t("nav.projecao")} · ${t("report.projectionHorizon", { n: v.proj.years })}`}>
              <MultiLine series={[
                { color: FAINT, data: v.proj.pSeries.map((p) => p.nominal) },
                { color: POS, data: v.proj.bSeries.map((p) => p.nominal) },
                { color: "#2E9E73", data: v.proj.oSeries.map((p) => p.nominal) },
              ]} years={v.proj.years} />
              <div style={{ display: "flex", gap: "16px", margin: "4px 0 8px", fontSize: "10.5px", color: MUTED }}>
                <Legend color={FAINT} label={t("report.scenarioPess")} />
                <Legend color={POS} label={t("report.scenarioBase")} />
                <Legend color="#2E9E73" label={t("report.scenarioOpt")} />
              </div>
              <HeadRow cols={[t("report.year"), t("report.scenarioPess"), t("report.scenarioBase"), t("report.scenarioOpt"), t("report.real")]} />
              {v.proj.yearMarks.map((y) => (
                <DataRow
                  key={y}
                  cols={[
                    `${y}a`,
                    compactMoney(v.proj.pSeries[y]?.nominal ?? 0, disp),
                    <strong>{compactMoney(v.proj.bSeries[y]?.nominal ?? 0, disp)}</strong>,
                    compactMoney(v.proj.oSeries[y]?.nominal ?? 0, disp),
                    <span style={{ color: FAINT }}>{compactMoney(v.proj.bSeries[y]?.real ?? 0, disp)}</span>,
                  ]}
                />
              ))}
            </Section>

            {/* Objetivos */}
            {v.goalRows.length > 0 ? (
              <Section title={t("nav.objetivos")}>
                {v.goalRows.map((g) => (
                  <div key={g.name} style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                      <span style={{ color: INK, fontWeight: 500 }}>{g.name}{g.deadline ? <span style={{ color: FAINT }}> · {g.deadline}</span> : null}</span>
                      <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{money(g.current)} / {money(g.target)} · {Math.round(g.pct)}%</span>
                    </div>
                    <div style={{ height: "5px", background: LINE, borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${g.pct}%`, background: POS }} />
                    </div>
                  </div>
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

// ── helpers de layout ────────────────────────────────────────────────────────
function Metric({ label, value, tone, big }: { label: string; value: string; tone?: string; big?: boolean }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: "8px", padding: "10px 12px" }}>
      <div style={{ fontSize: "9.5px", textTransform: "uppercase", letterSpacing: "0.08em", color: FAINT }}>{label}</div>
      <div style={{ fontSize: big ? "18px" : "15px", fontWeight: 600, marginTop: "3px", color: tone ?? INK, fontVariantNumeric: "tabular-nums", letterSpacing: big ? "-0.02em" : undefined }}>{value}</div>
    </div>
  );
}

function Section({ title, children, breakBefore }: { title: string; children: ReactNode; breakBefore?: boolean }) {
  return (
    <div style={{ marginBottom: "20px", breakInside: "avoid", breakBefore: breakBefore ? "page" : undefined }}>
      <div style={{ fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, fontWeight: 600, marginBottom: "8px" }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: "9.5px", textTransform: "uppercase", letterSpacing: "0.08em", color: FAINT, marginBottom: "5px" }}>{children}</div>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "4px 0", borderTop: `1px solid ${LINE}` }}>
      <span style={{ color: strong ? INK : MUTED, fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ color: INK, fontWeight: strong ? 700 : 500, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ padding: "3px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", marginBottom: "2px" }}>
        <span style={{ color: MUTED }}>{label}</span>
        <span style={{ color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: "4px", background: LINE, borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", padding: "1.5px 0" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: color, flexShrink: 0 }} />
      <span style={{ color: MUTED, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
      <span style={{ width: "12px", height: "2.5px", borderRadius: "2px", background: color }} />
      {label}
    </span>
  );
}

function HeadRow({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `1.3fr repeat(${cols.length - 1}, 1fr)`, gap: "8px", padding: "4px 0", borderBottom: `1px solid ${LINE}` }}>
      {cols.map((c, i) => (
        <span key={i} style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.06em", color: FAINT, textAlign: i === 0 ? "left" : "right" }}>{c}</span>
      ))}
    </div>
  );
}

function DataRow({ cols }: { cols: ReactNode[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `1.3fr repeat(${cols.length - 1}, 1fr)`, gap: "8px", padding: "3px 0", borderTop: `1px solid ${LINE}` }}>
      {cols.map((c, i) => (
        <span key={i} style={{ fontSize: "11.5px", color: i === 0 ? MUTED : INK, textAlign: i === 0 ? "left" : "right", fontVariantNumeric: "tabular-nums" }}>{c}</span>
      ))}
    </div>
  );
}

// ── mini-gráficos SVG (print-safe, sem medição/Recharts) ─────────────────────
function AreaChart({ data, w = 720, h = 120, color = POS }: { data: number[]; w?: number; h?: number; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1, pad = 6;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - 2 * pad);
  const y = (val: number) => pad + (1 - (val - min) / range) * (h - 2 * pad);
  const line = data.map((val, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(h - pad).toFixed(1)} L${x(0).toFixed(1)},${(h - pad).toFixed(1)} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={area} fill={color} fillOpacity={0.08} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MultiLine({ series, years, w = 720, h = 150 }: { series: { color: string; data: number[] }[]; years: number; w?: number; h?: number }) {
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1), pad = 6, padB = 4;
  const n = series[0]?.data.length ?? 0;
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (w - 2 * pad);
  const y = (val: number) => pad + (1 - val / max) * (h - pad - padB);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {series.map((s, si) => (
        <path key={si} d={s.data.map((val, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function Donut({ slices, size = 104 }: { slices: { value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2, ir = r * 0.6;
  let a0 = -Math.PI / 2;
  const pt = (rad: number, ang: number): [number, number] => [r + rad * Math.cos(ang), r + rad * Math.sin(ang)];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      {slices.map((s, i) => {
        const a1 = a0 + (s.value / total) * Math.PI * 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1), [xi1, yi1] = pt(ir, a1), [xi0, yi0] = pt(ir, a0);
        const d = `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${xi1.toFixed(1)},${yi1.toFixed(1)} A${ir},${ir} 0 ${large} 0 ${xi0.toFixed(1)},${yi0.toFixed(1)} Z`;
        a0 = a1;
        return <path key={i} d={d} fill={s.color} />;
      })}
    </svg>
  );
}
