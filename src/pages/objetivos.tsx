import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useObjetivos } from "@/hooks/use-objetivos";
import { actions } from "@/data/actions";
import { convert, type Currency } from "@/money/currency";
import type { Goal } from "@/domain/types";
import { Tile } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

export default function Objetivos() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useObjetivos();

  const cards = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    return data.map((g) => {
      const target = conv(g.target, g.currency);
      const current = conv(g.current, g.currency);
      const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
      return { ...g, target, current, pct };
    });
  }, [data, disp, rates]);

  if (!data || !cards) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const cols: GridColumn<Goal>[] = [
    { key: "currency", type: "currency", header: "", width: "46px" },
    { key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.7fr)", placeholder: t("objetivos.namePlaceholder") },
    { key: "current", type: "money", header: t("objetivos.current"), width: "minmax(110px,1fr)", align: "right", currencyKey: "currency" },
    { key: "target", type: "money", header: t("objetivos.target"), width: "minmax(110px,1fr)", align: "right", currencyKey: "currency" },
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

  const newGoal = (): Goal => ({ id: crypto.randomUUID(), name: "", currency: disp, target: 0, current: 0 });

  return (
    <div className="space-y-7">
      {cards.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((g) => (
            <Tile key={g.id} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium truncate">{g.name}</span>
                {g.deadline ? <span className="eyebrow shrink-0">{g.deadline}</span> : null}
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-3">
                <Money value={g.current} currency={disp} className="font-numeric font-semibold tabular text-[18px]" />
                <span className="text-[12.5px] text-faint tabular">
                  / <Money value={g.target} currency={disp} />
                </span>
              </div>
              <div className="mt-3 h-[8px] rounded-full bg-card2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ width: `${g.pct}%` }}
                />
              </div>
              <div className="mt-2 text-[11.5px] text-muted tabular">{Math.round(g.pct)}%</div>
            </Tile>
          ))}
        </div>
      ) : null}

      <section>
        <SectionHead title={t("nav.objetivos")} count={data.length} />
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
      </section>
    </div>
  );
}
