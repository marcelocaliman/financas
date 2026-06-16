import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useSettings } from "@/hooks/use-settings";
import { actions } from "@/data/actions";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { categoryColors } from "@/money/composition";
import { isInvestedClass, nameById } from "@/domain/taxonomy";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
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
    const positions = invested
      .map((a) => ({ ...a, disp: conv(a.amount, a.currency) }))
      .sort((a, b) => b.disp - a.disp);
    return { rows, total, totalTarget, positions, count: invested.length };
  }, [data, disp, rates, settings, tax]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const colorOf = (id: string) => CAT[view.rows.findIndex((r) => r.id === id) % CAT.length];
  const donut = view.rows.filter((r) => r.value > 0).map((r) => ({ name: r.name, value: r.value, id: r.id }));

  const setTarget = (classId: string, pct: number) => {
    const allocationTargets = { ...settings.allocationTargets };
    if (pct > 0) allocationTargets[classId] = pct;
    else delete allocationTargets[classId];
    void actions.putSettings({ ...settings, allocationTargets });
  };

  return (
    <div className="space-y-7">
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
                    <span className="block text-[11.5px] text-faint tabular">{r.curPct.toFixed(1)}%</span>
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
                        <span className="block text-[11px] text-faint">
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
                <Money value={a.disp} currency={disp} className="text-[13.5px] font-semibold tabular shrink-0" />
              </div>
            ))}
          </div>
        </Tile>
      ) : null}
    </div>
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
    const classes = new Set(invested.filter((a) => conv(a.amount, a.currency) > 0).map((a) => a.classId)).size;
    return { total, count: invested.length, classes };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("investimentos.total")} value={<Money value={v.total} currency={disp} />} />
      <HeaderKpi secondary label={t("investimentos.positions")} value={<span className="tabular">{v.count}</span>} />
      <HeaderKpi secondary label={t("investimentos.classes")} value={<span className="tabular">{v.classes}</span>} />
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
        className="w-12 h-8 px-1.5 rounded-[7px] border border-border bg-card text-[13px] tabular text-right outline-none focus:border-accent"
      />
      <span className="text-[12px] text-faint">%</span>
    </div>
  );
}
