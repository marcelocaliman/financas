import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CURRENCIES, type Currency } from "@/money/currency";
import { Segmented } from "@/components/common/segmented";
import { Button } from "@/components/common/button";
import type { Asset, AssetType, Liability, LiabilityType } from "@/domain/types";

const ASSET_TYPES: AssetType[] = ["investment", "property", "cash"];
const LIABILITY_TYPES: LiabilityType[] = ["loan", "card", "mortgage", "other"];

export type ItemKind = "asset" | "liability";

/** Formulário de criação/edição de um ativo ou passivo. */
export function ItemForm({
  kind,
  initial,
  onSubmit,
  onCancel,
}: {
  kind: ItemKind;
  initial?: Asset | Liability | null;
  onSubmit: (item: Asset | Liability) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "BRL");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [type, setType] = useState<AssetType | LiabilityType>(
    initial?.type ?? (kind === "asset" ? "investment" : "loan"),
  );
  const [err, setErr] = useState("");

  const types: (AssetType | LiabilityType)[] = kind === "asset" ? ASSET_TYPES : LIABILITY_TYPES;
  const typeGroup = kind === "asset" ? "assetType" : "liabilityType";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!name.trim()) return setErr(t("patrimonio.errName"));
    if (!Number.isFinite(value) || value <= 0) return setErr(t("patrimonio.errAmount"));
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      currency,
      amount: value,
      type,
    } as Asset | Liability);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {err ? <p className="text-[12.5px] text-neg">{err}</p> : null}

      <Label text={t("patrimonio.name")}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("patrimonio.namePlaceholder")}
          className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[14px] text-text outline-none focus:border-teal"
        />
      </Label>

      <Label text={t("patrimonio.type")}>
        <Segmented
          options={types.map((ty) => ({ value: ty, label: t(`patrimonio.${typeGroup}.${ty}`) }))}
          value={type}
          onChange={setType}
        />
      </Label>

      <Label text={t("patrimonio.currency")}>
        <Segmented
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          value={currency}
          onChange={setCurrency}
        />
      </Label>

      <Label text={t("patrimonio.amount")}>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[14px] text-text tabular-nums outline-none focus:border-teal"
        />
      </Label>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1">
          {t("common.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-muted font-medium mb-1.5">{text}</span>
      {children}
    </label>
  );
}
