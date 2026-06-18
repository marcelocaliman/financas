import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useSettings } from "@/hooks/use-settings";
import { useDividends } from "@/hooks/use-dividends";
import { actions } from "@/data/actions";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { categoryColors } from "@/money/composition";
import { isInvestedClass, isQuotableClass, nameById } from "@/domain/taxonomy";
import type { Dividend } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { Kpi } from "@/components/common/kpi";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";
import { cn } from "@/lib/utils";

export default function Investimentos() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  const tax = useTaxonomy();
  const settings = useSettings();
  const CAT = categoryColors(theme);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    // "Investido" = ativos financeiros (exclui Caixa e Imóveis) — mesmo seletor do Painel.
    const invested = data.assets.filter((a) => isInvestedClass(a.classId));
    const byClass = new Map<string, number>();
    for (const a of invested) byClass.set(a.classId, (byClass.get(a.classId) ?? 0) + conv(a.amount, a.currency));
    const total = [...byClass.values()].reduce((s, v) => s + v, 0);
    const targets = settings.allocationTargets;
    const ids = new Set<string>([...byClass.keys(), ...Object.keys(targets).filter((k) => targets[k] > 0)]);
    const rows = [...ids]
      .map((id) => {
        const value = byClass.get(id) ?? 0;
        const curPct = total > 0 ? (value / total) * 100 : 0;
        const tgtPct = targets[id] ?? 0;
        const delta = total > 0 ? (tgtPct / 100) * total - value : 0;
        return { id, name: nameById(tax.assetClasses, id) || id, value, curPct, tgtPct, delta };
      })
      .sort((a, b) => b.value - a.value);
    const totalTarget = rows.reduce((s, r) => s + r.tgtPct, 0);
    // Rentabilidade sobre posições com CUSTO conhecido: cotáveis usam qtd × preço médio;
    // as demais (renda fixa, outros) usam o "valor aplicado" (cost). Unifica as telas.
    let totalCost = 0;
    let totalCostValue = 0;
    const positions = invested
      .map((a) => {
        const value = conv(a.amount, a.currency);
        const cost = isQuotableClass(a.classId) ? (a.quantity ?? 0) * (a.avgPrice ?? 0) : (a.cost ?? 0); // moeda do ativo
        const hasCost = cost > 0;
        if (hasCost) {
          totalCost += conv(cost, a.currency);
          totalCostValue += value;
        }
        return { ...a, disp: value, retPct: hasCost ? ((a.amount - cost) / cost) * 100 : null };
      })
      .sort((a, b) => b.disp - a.disp);
    const gain = totalCostValue - totalCost;
    return {
      rows,
      total,
      totalTarget,
      positions,
      count: invested.length,
      totalCost,
      gain,
      returnPct: totalCost > 0 ? (gain / totalCost) * 100 : 0,
      hasCostBasis: totalCost > 0,
    };
  }, [data, disp, rates, settings, tax]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const colorOf = (id: string) => CAT[view.rows.findIndex((r) => r.id === id) % CAT.length];
  const donut = view.rows.filter((r) => r.value > 0).map((r) => ({ name: r.name, value: r.value, id: r.id }));

  const setTarget = (classId: string, pct: number) => {
    // Lê o mapa mais fresco no repo (não o snapshot do React) — preserva os outros
    // alvos e a moeda principal mesmo se as settings ainda não hidrataram.
    void actions.setAllocationTarget(classId, pct);
  };

  return (
    <div className="space-y-7">
      {/* Rentabilidade (só posições com preço médio) */}
      {view.hasCostBasis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label={t("investimentos.cost")} value={<Money value={view.totalCost} currency={disp} />} />
          <Kpi label={t("patrimonio.currentValue")} value={<Money value={view.totalCost + view.gain} currency={disp} />} />
          <Kpi label={t("investimentos.gain")} tone={view.gain >= 0 ? "accent" : "neg"} value={<Money value={view.gain} currency={disp} />} />
          <Kpi
            label={t("investimentos.profitability")}
            tone={view.returnPct >= 0 ? "accent" : "neg"}
            value={`${view.returnPct >= 0 ? "+" : ""}${view.returnPct.toFixed(1)}%`}
            bar={Math.min(100, Math.abs(view.returnPct))}
          />
        </div>
      ) : null}

      {/* Alocação × Alvo */}
      <Tile className="p-6 md:p-7">
        <div className="flex flex-col lg:flex-row items-start gap-7">
          {donut.length > 0 ? (
            <div className="w-[150px] h-[150px] shrink-0 mx-auto lg:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="none">
                    {donut.map((d) => (
                      <Cell key={d.id} fill={colorOf(d.id)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatMoney(Number(v), disp)}
                    contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className="flex-1 min-w-0 w-full overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1.1fr] pb-2 border-b border-border">
                <Eyebrow>{t("patrimonio.class")}</Eyebrow>
                <Eyebrow className="text-right">{t("investimentos.currentAlloc")}</Eyebrow>
                <Eyebrow className="text-right">{t("investimentos.target")}</Eyebrow>
                <Eyebrow className="text-right">{t("investimentos.rebalance")}</Eyebrow>
              </div>
              {view.rows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1.4fr_1fr_0.8fr_1.1fr] items-center py-2.5 border-b border-border last:border-0">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-[8px] h-[8px] rounded-[2px] shrink-0" style={{ background: colorOf(r.id) }} />
                    <span className="text-[13.5px] truncate">{r.name}</span>
                  </span>
                  <span className="text-right">
                    <Money value={r.value} currency={disp} className="text-[13px] tabular" />
                    <span className="block text-[11.5px] text-muted tabular"><Hidden>{r.curPct.toFixed(1) + "%"}</Hidden></span>
                  </span>
                  <div className="flex justify-end">
                    <TargetInput value={r.tgtPct} onCommit={(v) => setTarget(r.id, v)} />
                  </div>
                  <span className="text-right tabular text-[13px]">
                    {Math.abs(r.delta) < 1 || r.tgtPct === 0 ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <span className={r.delta > 0 ? "text-accent" : "text-neg"}>
                        {r.delta > 0 ? "+" : "−"}
                        {formatMoney(Math.abs(r.delta), disp).replace(/^[^\d]*/, "")}
                        <span className="block text-[11px] text-muted">
                          {r.delta > 0 ? t("investimentos.buy") : t("investimentos.sell")}
                        </span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {view.rows.length === 0 ? (
                <p className="text-[13px] text-faint py-4">{t("investimentos.empty")}</p>
              ) : null}
            </div>
          </div>
        </div>
        <p className="text-[11.5px] text-faint mt-4 leading-relaxed">{t("investimentos.hint")}</p>
      </Tile>

      {/* Posições */}
      {view.positions.length > 0 ? (
        <Tile className="p-6 md:p-7">
          <Eyebrow>{t("dashboard.positionsTitle")}</Eyebrow>
          <div className="mt-3 grid sm:grid-cols-2 gap-x-8">
            {view.positions.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0 sm:[&:nth-last-child(2)]:border-0">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={cn("chip", `chip-${a.currency}`)}>{a.currency}</span>
                  <span className="text-[13.5px] truncate">{a.name}</span>
                  <span className="text-[11.5px] text-faint truncate hidden sm:inline">
                    {nameById(tax.assetClasses, a.classId)}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  {a.retPct != null ? (
                    <span className={cn("text-[11.5px] tabular", a.retPct >= 0 ? "text-accent" : "text-neg")}>
                      <Hidden>{(a.retPct >= 0 ? "+" : "") + a.retPct.toFixed(1) + "%"}</Hidden>
                    </span>
                  ) : null}
                  <Money value={a.disp} currency={disp} className="text-[13.5px] font-semibold tabular" />
                </span>
              </div>
            ))}
          </div>
        </Tile>
      ) : null}

      {/* Proventos / dividendos (renda passiva) */}
      <Proventos invested={view.total} />
    </div>
  );
}

/** Mês "AAAA-MM" deslocado de `back` meses a partir de hoje. */
function monthKey(back: number): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() - back, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
}

/** Proventos recebidos: histórico, renda passiva (12m), média mensal e yield sobre o investido. */
function Proventos({ invested }: { invested: number }) {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const divs = useDividends();
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";
  const axis = theme === "dark" ? "#5f646c" : "#8a8f98";

  const v = useMemo(() => {
    const list = divs ?? [];
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const last12 = Array.from({ length: 12 }, (_, k) => monthKey(11 - k));
    const cutoff = last12[0];
    const ceil = last12[11]; // mês corrente — limita a janela (ignora datas futuras)
    const byMonth = new Map<string, number>();
    let total = 0;
    let passive = 0;
    for (const d of list) {
      const val = conv(d.amount, d.currency);
      total += val;
      if (d.month >= cutoff && d.month <= ceil) {
        passive += val;
        byMonth.set(d.month, (byMonth.get(d.month) ?? 0) + val);
      }
    }
    const monthly = last12.map((m) => ({ m: m.slice(5), value: byMonth.get(m) ?? 0 }));
    return {
      total,
      passive,
      avg: passive / 12,
      yieldPct: invested > 0 ? (passive / invested) * 100 : 0,
      monthly,
      hasAny: list.length > 0,
    };
  }, [divs, disp, rates, invested]);

  const cols: GridColumn<Dividend>[] = [
    { key: "source", type: "text", header: t("proventos.source"), width: "minmax(120px,1.4fr)", placeholder: "BBAS3" },
    { key: "month", type: "text", header: t("historico.month"), width: "minmax(100px,0.9fr)", placeholder: t("historico.monthPlaceholder") },
    { key: "amount", type: "money", header: t("proventos.amount"), width: "minmax(150px,1.1fr)", align: "right", currencyKey: "currency" },
  ];

  return (
    <section className="space-y-4">
      <Eyebrow>{t("proventos.title")}</Eyebrow>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t("proventos.passive12m")} tone="accent" value={<Money value={v.passive} currency={disp} />} />
        <Kpi label={t("proventos.monthlyAvg")} value={<Money value={v.avg} currency={disp} />} />
        <Kpi label={t("proventos.yield")} tone={v.yieldPct > 0 ? "accent" : "text"} value={`${v.yieldPct.toFixed(2)}%`} />
        <Kpi label={t("proventos.total")} value={<Money value={v.total} currency={disp} />} />
      </div>

      {v.passive > 0 ? (
        <Tile className="p-6 md:p-7">
          <Eyebrow className="mb-4">{t("proventos.last12")}</Eyebrow>
          <div className="w-full h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={v.monthly} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
                <XAxis dataKey="m" tick={{ fontSize: 10.5, fill: axis }} axisLine={false} tickLine={false} dy={4} />
                <Tooltip
                  cursor={{ fill: "var(--card-2)" }}
                  formatter={(val) => [formatMoney(Number(val), disp), t("proventos.received")]}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                  labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
                />
                <Bar dataKey="value" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tile>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[460px]">
          <DataGrid<Dividend>
            columns={cols}
            rows={[...(divs ?? [])].sort((a, b) => (a.month < b.month ? 1 : -1))}
            blank={() => ({ id: crypto.randomUUID(), source: "", month: "", currency: base, amount: 0 })}
            isComplete={(r) => r.source.trim().length > 0 && r.month.trim().length > 0 && r.amount > 0}
            onCommit={(r) => void actions.putDividend(r)}
            onDelete={(id) => void actions.removeDividend(id)}
            addPlaceholder={t("proventos.add")}
            total={<Money value={v.total} currency={disp} />}
          />
        </div>
      </div>
      <p className="text-[11.5px] text-faint px-1 leading-relaxed">{t("proventos.hint")}</p>
    </section>
  );
}

/** KPIs do cabeçalho do accordion de Investimentos. */
export function InvestimentosSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const invested = data.assets.filter((a) => isInvestedClass(a.classId));
    const total = invested.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    let totalCost = 0;
    let totalCostValue = 0;
    for (const a of invested) {
      // Mesmo custo unificado da página: cotável = qtd×preço médio; demais = valor aplicado.
      const cost = isQuotableClass(a.classId) ? (a.quantity ?? 0) * (a.avgPrice ?? 0) : (a.cost ?? 0);
      if (cost > 0) {
        totalCost += conv(cost, a.currency);
        totalCostValue += conv(a.amount, a.currency);
      }
    }
    return {
      total,
      count: invested.length,
      returnPct: totalCost > 0 ? ((totalCostValue - totalCost) / totalCost) * 100 : null,
    };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("investimentos.total")} value={<Money value={v.total} currency={disp} />} />
      {v.returnPct != null ? (
        <HeaderKpi
          secondary
          label={t("investimentos.profitability")}
          tone={v.returnPct >= 0 ? "accent" : "neg"}
          value={`${v.returnPct >= 0 ? "+" : ""}${v.returnPct.toFixed(1)}%`}
        />
      ) : null}
      <HeaderKpi secondary label={t("investimentos.positions")} value={<span className="tabular">{v.count}</span>} />
    </HeaderKpis>
  );
}

function TargetInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(() => (value > 0 ? String(value) : ""));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(value > 0 ? String(value) : "");
  }, [value, focused]);
  const commit = () => {
    const n = Number(v.replace(",", "."));
    if (v.trim() === "") onCommit(0);
    else if (!Number.isNaN(n) && n >= 0 && n !== value) onCommit(n);
    else setV(value > 0 ? String(value) : "");
  };
  return (
    <div className="inline-flex items-center gap-1">
      <input
        inputMode="decimal"
        value={v}
        placeholder="—"
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-12 h-8 px-1.5 rounded-[7px] border border-border bg-card text-[13px] tabular text-right outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
      />
      <span className="text-[12px] text-faint">%</span>
    </div>
  );
}
