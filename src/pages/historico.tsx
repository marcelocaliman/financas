import { useTranslation } from "react-i18next";
import { TrendArea } from "@/components/charts/trend-area";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useHistorico } from "@/hooks/use-historico";
import { useHistoricoView } from "@/hooks/use-historico-view";
import { useBudget } from "@/hooks/use-budget";
import { goToSection } from "@/hooks/use-scroll-spy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { budgetSaldoForMonth } from "@/finance/budget-saldo";
import type { NetWorthSnapshot } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { Kpi } from "@/components/common/kpi";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

export default function Historico() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const data = useHistorico();
  const budget = useBudget();
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";

  // View derivada compartilhada com o HistoricoSummary (fonte única — não recalcular aqui).
  const view = useHistoricoView();

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);

  // Histórico é passado/presente: o seletor de mês não deixa escolher mês futuro.
  const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const cols: GridColumn<NetWorthSnapshot>[] = [
    { key: "month", type: "month", header: t("historico.month"), width: "minmax(120px,1fr)", maxMonth: thisMonth },
    { key: "amount", type: "money", header: t("historico.networth"), width: "minmax(160px,1.2fr)", align: "right", currencyKey: "currency" },
    { key: "contribution", type: "number", decimals: 2, header: t("historico.contribution"), width: "minmax(100px,0.9fr)", align: "right" },
  ];
  // "Em <moeda>" só aparece quando há de fato conversão (algum registro em moeda ≠ da exibida).
  if (view.sorted.some((s) => s.currency !== disp)) {
    cols.push({
      key: "conv",
      type: "computed",
      header: `${t("patrimonio.in")} ${CURRENCY_SYMBOL[disp]}`,
      width: "minmax(88px,0.8fr)",
      align: "right",
      compute: (r) => formatMoney(conv(r.amount, r.currency), disp),
    });
  }

  // Linha-fantasma: moeda VAZIA → a coluna do valor mostra "—" (não pré-seleciona "R$"). Ao
  // salvar, `defaultCurrency={base}` preenche a moeda principal (o patrimônio é sempre na base).
  const newSnap = (): NetWorthSnapshot => ({ id: crypto.randomUUID(), month: "", currency: "" as Currency, amount: 0 });

  const up = view.change >= 0;
  const yieldUp = view.yieldGain >= 0;
  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Indicadores da evolução: atual · crescimento · aporte vs rendimento · período */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label={t("historico.current")} value={<Money value={view.current} currency={disp} />} sub={view.last?.label} />
        <Kpi
          label={t("historico.growth")}
          value={<Money value={view.growth} currency={disp} options={{ signDisplay: "always" }} />}
          tone={up ? "accent" : "neg"}
          sub={view.hasTrend ? <Hidden>{`${up ? "+" : ""}${view.change.toFixed(1)}%`}</Hidden> : "—"}
        />
        <Kpi label={t("historico.contributions")} value={view.hasTrend ? <Money value={view.contributions} currency={disp} /> : "—"} sub={t("historico.contributionsSub")} />
        <Kpi
          // Não reconciliado: o card vira "A aplicar" e mostra a SOBRA que ficou de fora do
          // patrimônio (acionável: aplicar/registrar), em vez de um "rendimento" vermelho enganoso.
          label={view.unreconciled ? t("historico.unapplied") : t("historico.return")}
          value={
            view.unreconciled ? (
              <Money value={view.unreflected} currency={disp} />
            ) : view.hasTrend ? (
              <Money value={view.yieldGain} currency={disp} options={{ signDisplay: "always" }} />
            ) : (
              "—"
            )
          }
          tone={view.unreconciled ? "text" : yieldUp ? "accent" : "neg"}
          sub={view.unreconciled ? t("historico.unappliedSub") : t("historico.returnSub")}
          title={view.unreconciled ? t("historico.reconcileHint") : undefined}
          // Atalho: leva ao Patrimônio pra registrar/aplicar a sobra que ficou de fora.
          onClick={view.unreconciled ? () => goToSection("patrimonio") : undefined}
        />
        <Kpi label={t("historico.period")} value={t("historico.monthsValue", { n: view.months })} sub={view.first && view.last ? `${view.first.label} → ${view.last.label}` : "—"} />
      </div>

      {view.hasTrend ? (
        <Tile className="p-4 sm:p-6 md:p-7">
          <Eyebrow className="mb-4">{t("dashboard.netWorthTrend")}</Eyebrow>
          <div className="w-full h-[230px]">
            <TrendArea data={view.series} xKey="m" yKey="v" color={accent} axisColor="var(--faint)" currency={disp} lang={lang} name={t("common.networth")} />
          </div>
        </Tile>
      ) : null}

      <section>
        <SectionHead title={t("historico.snapshots")} count={data.length} />
        <div className="overflow-x-auto">
          <div className="min-w-0 sm:min-w-[560px]">
            <DataGrid<NetWorthSnapshot>
              columns={cols}
              rows={view.sorted}
              blank={newSnap}
              defaultCurrency={base}
              isComplete={(r) => r.month.trim().length > 0 && r.amount > 0}
              onCommit={(r) => {
                const next: NetWorthSnapshot = { ...r, auto: false };
                // Ponte com o orçamento: aporte em branco → sugere o saldo do mês — mas só se houver
                // um mês ANTERIOR (o aporte decompõe o crescimento; no 1º mês não faz sentido).
                if (next.contribution == null && data.some((s) => s.id !== next.id && s.month < next.month)) {
                  const saldo = budgetSaldoForMonth(next.month, budget, next.currency, rates);
                  if (saldo != null) next.contribution = saldo;
                }
                void actions.putSnapshot(next);
              }}
              onDelete={(id) => void actions.removeSnapshot(id)}
              addPlaceholder={t("historico.addSnapshot")}
            />
          </div>
        </div>
        <p className="text-[11.5px] text-faint mt-2 px-1 leading-relaxed">{t("historico.autoHint")}</p>
      </section>
    </div>
  );
}
