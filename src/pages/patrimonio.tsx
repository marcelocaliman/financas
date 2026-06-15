import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Wallet } from "lucide-react";
import { useUI } from "@/store/ui";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { actions } from "@/data/actions";
import { convert, type Currency } from "@/money/currency";
import { currencyBreakdown, CUR_COLOR } from "@/money/composition";
import type { Asset, AssetType, Liability } from "@/domain/types";
import { Panel } from "@/components/common/panel";
import { Money } from "@/components/common/money";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
import { CompositionBar } from "@/components/patrimonio/composition-bar";
import { ItemRow } from "@/components/patrimonio/item-row";
import { ItemForm, type ItemKind } from "@/components/patrimonio/item-form";
import { cn } from "@/lib/utils";

const ASSET_ORDER: AssetType[] = ["investment", "property", "cash"];

type FormState = { kind: ItemKind; item: Asset | Liability | null } | null;
type DeleteState = { kind: ItemKind; id: string; name: string } | null;

export default function Patrimonio() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const data = usePatrimonio();
  const [form, setForm] = useState<FormState>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteState>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (amount: number, from: Currency) => convert(amount, from, disp);
    const assets = data.assets.map((a) => ({ ...a, disp: conv(a.amount, a.currency) }));
    const liabilities = data.liabilities
      .map((l) => ({ ...l, disp: conv(l.amount, l.currency) }))
      .sort((a, b) => b.disp - a.disp);
    const totalAssets = assets.reduce((s, a) => s + a.disp, 0);
    const totalLiab = liabilities.reduce((s, l) => s + l.disp, 0);

    const segments = currencyBreakdown(data.assets, disp).map((s) => ({
      label: s.currency,
      pct: s.pct,
      color: CUR_COLOR[s.currency],
    }));

    const groups = ASSET_ORDER.map((ty) => ({
      type: ty,
      items: assets.filter((a) => a.type === ty).sort((x, y) => y.disp - x.disp),
    })).filter((g) => g.items.length > 0);

    return {
      assets,
      liabilities,
      totalAssets,
      totalLiab,
      netWorth: totalAssets - totalLiab,
      segments,
      groups,
    };
  }, [data, disp]);

  if (!view) {
    return <div className="h-40 rounded-2xl bg-card border border-border animate-pulse" />;
  }

  const isEmpty = view.assets.length === 0 && view.liabilities.length === 0;

  const handleSubmit = (item: Asset | Liability) => {
    if (form?.kind === "asset") void actions.putAsset(item as Asset);
    else void actions.putLiability(item as Liability);
    setForm(null);
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "asset") void actions.removeAsset(pendingDelete.id);
    else void actions.removeLiability(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <div className="space-y-5">
      {isEmpty ? (
        <EmptyState
          onAdd={() => setForm({ kind: "asset", item: null })}
          onLoadSample={() => void actions.loadSample()}
        />
      ) : (
        <>
          {/* Hero: patrimônio líquido + composição por moeda */}
          <Panel className="p-6 md:p-7">
            <div className="text-[13px] text-muted font-medium">{t("patrimonio.netWorth")}</div>
            <Money
              value={view.netWorth}
              currency={disp}
              className={cn(
                "block text-[40px] font-bold tracking-[-0.02em] leading-tight mt-1",
                view.netWorth < 0 && "text-neg",
              )}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[13px]">
              <span className="text-muted">
                {t("patrimonio.assets")}{" "}
                <Money value={view.totalAssets} currency={disp} className="font-semibold text-text" />
              </span>
              <span className="text-muted">
                {t("patrimonio.liabilities")}{" "}
                <Money
                  value={view.totalLiab}
                  currency={disp}
                  className="font-semibold text-neg"
                  options={{ signDisplay: "never" }}
                />
              </span>
            </div>
            {view.segments.length > 0 ? (
              <div className="mt-6">
                <CompositionBar segments={view.segments} />
              </div>
            ) : null}
          </Panel>

          {/* Ativos */}
          <SectionPanel
            title={t("patrimonio.assets")}
            total={view.totalAssets}
            disp={disp}
            addLabel={t("patrimonio.addAsset")}
            onAdd={() => setForm({ kind: "asset", item: null })}
          >
            {view.groups.length === 0 ? (
              <EmptyHint text={t("patrimonio.noAssetsDesc")} />
            ) : (
              view.groups.map((g) => (
                <div key={g.type} className="pt-1">
                  <div className="flex items-center justify-between text-[11.5px] text-faint font-medium uppercase tracking-wide mt-2 mb-0.5">
                    <span>{t(`patrimonio.assetType.${g.type}`)}</span>
                  </div>
                  {g.items.map((a) => (
                    <ItemRow
                      key={a.id}
                      name={a.name}
                      typeLabel={t(`patrimonio.assetType.${a.type}`)}
                      currency={a.currency}
                      amount={a.amount}
                      displayValue={a.disp}
                      displayCurrency={disp}
                      onEdit={() => setForm({ kind: "asset", item: a })}
                      onDelete={() => setPendingDelete({ kind: "asset", id: a.id, name: a.name })}
                    />
                  ))}
                </div>
              ))
            )}
          </SectionPanel>

          {/* Passivos */}
          <SectionPanel
            title={t("patrimonio.liabilities")}
            total={view.totalLiab}
            disp={disp}
            negative
            addLabel={t("patrimonio.addLiability")}
            onAdd={() => setForm({ kind: "liability", item: null })}
          >
            {view.liabilities.length === 0 ? (
              <EmptyHint text={t("patrimonio.noLiabilitiesDesc")} />
            ) : (
              view.liabilities.map((l) => (
                <ItemRow
                  key={l.id}
                  name={l.name}
                  typeLabel={t(`patrimonio.liabilityType.${l.type}`)}
                  currency={l.currency}
                  amount={l.amount}
                  displayValue={l.disp}
                  displayCurrency={disp}
                  negative
                  onEdit={() => setForm({ kind: "liability", item: l })}
                  onDelete={() => setPendingDelete({ kind: "liability", id: l.id, name: l.name })}
                />
              ))
            )}
          </SectionPanel>
        </>
      )}

      {/* Form add/edit */}
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={
          form
            ? t(
                form.item
                  ? form.kind === "asset"
                    ? "patrimonio.editAsset"
                    : "patrimonio.editLiability"
                  : form.kind === "asset"
                    ? "patrimonio.addAsset"
                    : "patrimonio.addLiability",
              )
            : ""
        }
      >
        {form ? (
          <ItemForm
            kind={form.kind}
            initial={form.item}
            onSubmit={handleSubmit}
            onCancel={() => setForm(null)}
          />
        ) : null}
      </Dialog>

      {/* Confirma exclusão */}
      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("patrimonio.delete")}
      >
        <p className="text-[13.5px] text-muted leading-relaxed mb-4">
          {t("patrimonio.deleteConfirm", { name: pendingDelete?.name })}
        </p>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={handleDelete}>
            {t("patrimonio.delete")}
          </Button>
          <Button variant="secondary" onClick={() => setPendingDelete(null)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SectionPanel({
  title,
  total,
  disp,
  negative,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  total: number;
  disp: Currency;
  negative?: boolean;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-semibold text-[15px]">{title}</span>
          <Money
            value={total}
            currency={disp}
            className={cn("text-[13px]", negative ? "text-neg" : "text-muted")}
            options={negative ? { signDisplay: "never" } : undefined}
          />
        </div>
        <Button onClick={onAdd} className="shrink-0">
          <Plus size={15} />
          <span className="hidden sm:inline">{addLabel}</span>
        </Button>
      </div>
      <div>{children}</div>
    </Panel>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-[13px] text-faint py-3">{text}</p>;
}

function EmptyState({ onAdd, onLoadSample }: { onAdd: () => void; onLoadSample: () => void }) {
  const { t } = useTranslation();
  return (
    <Panel className="p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-teal-soft text-teal flex items-center justify-center mx-auto mb-4">
        <Wallet size={22} />
      </div>
      <div className="text-[16px] font-semibold">{t("patrimonio.noAssets")}</div>
      <p className="text-[13px] text-muted mt-1 max-w-xs mx-auto leading-relaxed">
        {t("patrimonio.noAssetsDesc")}
      </p>
      <div className="flex items-center justify-center gap-2 mt-5">
        <Button onClick={onAdd}>
          <Plus size={15} />
          {t("patrimonio.addAsset")}
        </Button>
        <Button variant="secondary" onClick={onLoadSample}>
          {t("data.loadSample")}
        </Button>
      </div>
    </Panel>
  );
}
