import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Target, X } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useObjetivos } from "@/hooks/use-objetivos";
import { actions } from "@/data/actions";
import { convert, type Currency } from "@/money/currency";
import type { Goal } from "@/domain/types";
import { Money } from "@/components/common/money";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";
import { Card, PageTitle, SectionGroup, CardGrid, StatCard } from "../ui";

const ACCENT = "#15976a";

export default function ObjetivosV2() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const data = useObjetivos();

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const cards = data.map((g) => {
      const target = conv(g.target, g.currency);
      const current = conv(g.current, g.currency);
      const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
      return { ...g, dispTarget: target, dispCurrent: current, pct };
    });
    const saved = cards.reduce((s, g) => s + g.dispCurrent, 0);
    const avg = cards.length ? cards.reduce((s, g) => s + g.pct, 0) / cards.length : 0;
    return { cards, saved, avg, count: cards.length };
  }, [data, disp, rates]);

  if (!data || !view) {
    return <div className="h-[60vh] rounded-[22px] bg-card/50 border border-border animate-pulse" />;
  }

  const cols: GridColumn<Goal>[] = [
    { key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.7fr)", placeholder: t("objetivos.namePlaceholder") },
    { key: "current", type: "money", header: t("objetivos.current"), width: "minmax(140px,1fr)", align: "right", currencyKey: "currency" },
    { key: "target", type: "money", header: t("objetivos.target"), width: "minmax(140px,1fr)", align: "right", currencyKey: "currency" },
    { key: "deadline", type: "text", header: t("objetivos.deadline"), width: "minmax(90px,0.8fr)", placeholder: "—" },
    {
      key: "progress",
      type: "computed",
      header: "%",
      width: "minmax(64px,0.6fr)",
      align: "right",
      compute: (r) => `${r.target > 0 ? Math.round(Math.min(100, (r.current / r.target) * 100)) : 0}%`,
    },
  ];

  const newGoal = (): Goal => ({ id: crypto.randomUUID(), name: "", currency: base, target: 0, current: 0 });

  return (
    <div>
      <PageTitle title={t("nav.objetivos")} subtitle={t("v2.objetivosSubtitle", "")} />

      <CardGrid className="mb-8">
        <StatCard label={t("objetivos.saved")} value={<Money value={view.saved} currency={disp} />} icon={<Target size={16} />} />
        <StatCard label={t("objetivos.avgProgress")} value={`${Math.round(view.avg)}%`} tone="accent" />
        <StatCard label={t("nav.objetivos")} value={String(view.count)} tone="muted" />
      </CardGrid>

      {view.cards.length > 0 ? (
        <SectionGroup title={t("nav.objetivos")}>
          <CardGrid>
            {view.cards.map((g) => (
              <Card key={g.id} className="p-6 group relative">
                <button
                  type="button"
                  onClick={() => void actions.removeGoal(g.id)}
                  aria-label={t("common.close")}
                  className="absolute top-4 right-4 grid place-items-center w-7 h-7 rounded-[8px] text-faint hover:text-neg hover:bg-[var(--neg-soft)] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                >
                  <X size={15} />
                </button>

                <div className="flex items-center gap-3 mb-4 pr-8">
                  <Ring pct={g.pct} />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold tracking-[-0.01em] truncate">
                      {g.name || t("objetivos.namePlaceholder")}
                    </div>
                    {g.deadline ? <div className="text-[11.5px] text-faint mt-0.5">{g.deadline}</div> : null}
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <Money value={g.dispCurrent} currency={disp} className="text-[18px] font-semibold tabular" />
                  <span className="text-[12.5px] text-faint">
                    / <Money value={g.dispTarget} currency={disp} className="tabular" />
                  </span>
                </div>

                <div className="mt-3 h-2.5 rounded-full bg-card2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ width: `${Math.min(100, Math.max(g.pct > 0 ? 2 : 0, g.pct))}%` }}
                  />
                </div>
                <div className="mt-2 text-[11.5px] text-muted tabular">{Math.round(g.pct)}%</div>
              </Card>
            ))}
          </CardGrid>
        </SectionGroup>
      ) : null}

      <SectionGroup title={t("common.edit")}>
        <Card className="p-2 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <DataGrid<Goal>
                columns={cols}
                rows={data}
                blank={newGoal}
                isComplete={(r) => r.name.trim().length > 0 && r.target > 0}
                onCommit={(r) => void actions.putGoal(r)}
                onDelete={(id) => void actions.removeGoal(id)}
                addPlaceholder={t("objetivos.addGoal")}
              />
            </div>
          </div>
        </Card>
      </SectionGroup>
    </div>
  );
}

/** Anel de progresso (SVG) — verde de acento sobre trilha cinza. */
function Ring({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" className="shrink-0 -rotate-90">
      <circle cx={20} cy={20} r={r} fill="none" stroke="var(--card-2)" strokeWidth={4} />
      <circle
        cx={20}
        cy={20}
        r={r}
        fill="none"
        stroke={ACCENT}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}
