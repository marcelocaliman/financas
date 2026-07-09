import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag, RotateCcw, Trash2, ChevronDown, CalendarClock } from "lucide-react";
import { actions } from "@/data/actions";
import { useDisposedAssets } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { nameById } from "@/domain/taxonomy";
import { CURRENCY_SYMBOL, formatMoney } from "@/money/currency";
import { Money } from "@/components/common/money";
import { Dialog } from "@/components/common/dialog";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";
import { isHoldingsClass, holdingsCost } from "@/finance/holdings";
import type { Asset, AssetHolding } from "@/domain/types";
import { cn } from "@/lib/utils";

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };
const todayISO = () => new Date().toISOString().slice(0, 10);
function fmtDate(iso: string | undefined, lang: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/** Rótulo legível de um ativo (nome livre → subtipo → classe). */
function useAssetLabel() {
  const tax = useTaxonomy();
  return (a: Asset) => a.name?.trim() || nameById(tax.subtypes, a.subtypeId ?? "") || nameById(tax.assetClasses, a.classId) || "—";
}

const DATE_INPUT =
  "h-9 rounded-[8px] border border-border bg-card2 px-2.5 text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

/** Painel de detalhe (expand) de um ativo ATIVO: posições discriminadas (nas classes negociáveis) +
 *  data de aquisição opcional + "marcar como vendido". */
export function AssetDetailPanel({ asset }: { asset: Asset }) {
  const { t } = useTranslation();
  const [selling, setSelling] = useState(false);
  return (
    <div className="space-y-4">
      {/* Discriminar posições (ações/FIIs/cripto…): detalhe ticker/qtd/preço médio — NÃO muda o total. */}
      {isHoldingsClass(asset.classId) ? (
        <div className="space-y-2">
          <p className="text-[11px] text-faint leading-relaxed">{t("patrimonio.holdingsHint")}</p>
          <AssetHoldingsGrid asset={asset} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <label className="text-[11px] text-faint">
          <span className="block mb-1">{t("patrimonio.acquiredOn")}</span>
          <input
            type="date"
            value={asset.acquiredOn ?? ""}
            onChange={(e) => void actions.putAsset({ ...asset, acquiredOn: e.target.value || undefined })}
            className={DATE_INPUT}
          />
          <span className="block mt-1 text-[10px] text-faint">{t("patrimonio.acquiredHint")}</span>
        </label>
        <button
          type="button"
          onClick={() => setSelling(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-border bg-card text-[12.5px] font-medium text-text hover:border-border-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Tag size={14} /> {t("patrimonio.markSold")}
        </button>
        <SellAssetDialog asset={asset} open={selling} onClose={() => setSelling(false)} />
      </div>
    </div>
  );
}

/** Mini-tabela de POSIÇÕES do ativo (ticker · quantidade · preço médio → custo). Salva embutido no
 *  ativo (não vira linha no patrimônio); o `cost` (aplicado) deriva das posições. Não toca no total. */
function AssetHoldingsGrid({ asset }: { asset: Asset }) {
  const { t } = useTranslation();
  const holdings = asset.holdings ?? [];
  // Ao mudar posições: deriva o custo (Σ qtd×preço médio); some com o array vazio (volta ao agregado).
  const save = (next: AssetHolding[]) =>
    void actions.putAsset({ ...asset, holdings: next.length ? next : undefined, ...(next.length ? { cost: holdingsCost(next) } : {}) });
  const cols: GridColumn<AssetHolding>[] = [
    { key: "ticker", type: "text", header: t("patrimonio.holdingTicker"), width: "minmax(88px,1.2fr)", placeholder: "PETR4" },
    { key: "quantity", type: "number", header: t("patrimonio.holdingQty"), width: "minmax(84px,0.8fr)", align: "right" },
    { key: "avgPrice", type: "number", decimals: 2, header: `${t("patrimonio.holdingAvg")} (${CURRENCY_SYMBOL[asset.currency]})`, width: "minmax(104px,0.9fr)", align: "right" },
    { key: "cost", type: "computed", header: t("patrimonio.holdingCost"), width: "minmax(104px,0.9fr)", align: "right", compute: (h) => formatMoney((h.quantity || 0) * (h.avgPrice || 0), asset.currency) },
  ];
  return (
    <DataGrid<AssetHolding>
      columns={cols}
      rows={holdings}
      blank={() => ({ id: crypto.randomUUID(), ticker: "", quantity: 0, avgPrice: 0 })}
      isComplete={(h) => h.ticker.trim().length > 0 && h.quantity > 0 && h.avgPrice > 0}
      onCommit={(h) => save(holdings.some((x) => x.id === h.id) ? holdings.map((x) => (x.id === h.id ? h : x)) : [...holdings, h])}
      onDelete={(id) => save(holdings.filter((x) => x.id !== id))}
      addPlaceholder={t("patrimonio.holdingAdd")}
      total={<Money value={holdingsCost(holdings)} currency={asset.currency} />}
      sortable
    />
  );
}

/** Registrar a venda de um bem: data (obrigatória) + valor recebido (opcional) + data de aquisição. */
function SellAssetDialog({ asset, open, onClose }: { asset: Asset; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(asset.disposedOn ?? todayISO());
  const [value, setValue] = useState(asset.disposalValue != null ? String(asset.disposalValue) : "");
  const [acq, setAcq] = useState(asset.acquiredOn ?? "");
  const sym = CURRENCY_SYMBOL[asset.currency];

  function confirm() {
    if (!date) return;
    const n = Number(value.replace(",", "."));
    void actions.putAsset({
      ...asset,
      disposedOn: date,
      disposalValue: value.trim() && Number.isFinite(n) ? n : undefined,
      acquiredOn: acq || asset.acquiredOn,
    });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("patrimonio.sellTitle")}>
      <div className="space-y-3">
        <label className="block text-[11px] text-faint">
          <span className="block mb-1">{t("patrimonio.sellDate")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(DATE_INPUT, "w-full")} />
        </label>
        <label className="block text-[11px] text-faint">
          <span className="block mb-1">{t("patrimonio.sellValue", { cur: asset.currency })}</span>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted">{sym}</span>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="—"
              className="h-9 flex-1 rounded-[8px] border border-border bg-card2 px-2.5 text-[13px] text-text tabular text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>
        </label>
        <label className="block text-[11px] text-faint">
          <span className="block mb-1">{t("patrimonio.acquiredOn")} <span className="text-faint">({t("common.optional")})</span></span>
          <input type="date" value={acq} onChange={(e) => setAcq(e.target.value)} className={cn(DATE_INPUT, "w-full")} />
        </label>
        <p className="text-[11.5px] text-muted leading-relaxed rounded-[8px] bg-card2/60 border border-border px-3 py-2">{t("patrimonio.sellNote")}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-[9px] border border-border bg-card text-[12.5px] font-medium text-text hover:border-border-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={confirm} disabled={!date} className="h-9 px-4 rounded-[9px] bg-accent text-[#08130C] text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            {t("patrimonio.sellConfirm")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Seção "Vendidos em AAAA" — bens baixados, guardados p/ o IRPF. Colapsada; reativar/excluir. */
export function DisposedAssetsSection() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disposed = useDisposedAssets();
  const label = useAssetLabel();
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => (disposed ?? []).slice().sort((a, b) => (b.disposedOn ?? "").localeCompare(a.disposedOn ?? "")),
    [disposed],
  );
  if (!sorted.length) return null;

  return (
    <section className="border-t border-border pt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[10px] py-1"
      >
        <span className="flex items-center gap-2.5">
          <ChevronDown size={18} className={cn("text-muted transition-transform", open && "rotate-180")} />
          <span className="eyebrow">{t("patrimonio.soldSection")}</span>
          <span className="text-faint tabular text-[12px]">{sorted.length}</span>
        </span>
        <CalendarClock size={15} className="text-faint shrink-0" />
      </button>
      {open ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11.5px] text-faint leading-relaxed max-w-2xl">{t("patrimonio.soldNote")}</p>
          <ul className="divide-y divide-[var(--grid-line)] rounded-[12px] border border-border overflow-hidden">
            {sorted.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] text-text truncate">{label(a)}</div>
                  <div className="text-[11.5px] text-faint tabular">{t("patrimonio.soldOn", { date: fmtDate(a.disposedOn, lang) })}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.disposalValue != null ? (
                    <Money value={a.disposalValue} currency={a.currency} className="text-[12.5px] text-muted tabular mr-1" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void actions.putAsset({ ...a, disposedOn: undefined, disposalValue: undefined })}
                    title={t("patrimonio.reactivate")}
                    aria-label={t("patrimonio.reactivate")}
                    className="grid place-items-center w-8 h-8 rounded-[8px] text-faint hover:text-accent hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void actions.removeAsset(a.id)}
                    title={t("common.remove")}
                    aria-label={t("common.remove")}
                    className="grid place-items-center w-8 h-8 rounded-[8px] text-faint hover:text-neg hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
