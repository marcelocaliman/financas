"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPhysicalAsset,
  updatePhysicalAsset,
  type PhysicalAssetFormState,
} from "@/services/physical-assets.actions";
import type { Currency, PhysicalAssetCategory, Tables } from "@/types/database";
import { CATEGORY_LABELS } from "@/lib/financial/asset-categories";

type Asset = Tables<"physical_assets">;

const CATEGORIES: PhysicalAssetCategory[] = [
  "real_estate",
  "vehicle",
  "electronics",
  "furniture",
  "jewelry",
  "art",
  "tools",
  "other",
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "BRL", label: "R$ BRL" },
  { value: "EUR", label: "€ EUR" },
  { value: "USD", label: "US$ USD" },
];

export function PhysicalAssetSheet({
  open,
  onOpenChange,
  asset,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset?: Asset | null;
  defaultCategory?: PhysicalAssetCategory;
}) {
  const isEdit = !!asset;
  const [category, setCategory] = useState<PhysicalAssetCategory>(
    asset?.category ?? defaultCategory ?? "other",
  );
  const [currency, setCurrency] = useState<Currency>(asset?.currency ?? "BRL");

  const [state, action, pending] = useActionState<
    PhysicalAssetFormState | undefined,
    FormData
  >(isEdit ? updatePhysicalAsset : createPhysicalAsset, undefined);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCategory(asset?.category ?? defaultCategory ?? "other");
      setCurrency(asset?.currency ?? "BRL");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Bem atualizado." : "Bem cadastrado.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar bem" : "Novo bem"}
          title={isEdit ? "Editar bem." : "Adicionar bem ao patrimônio."}
          description="Apartamento, carro, moto, computador, joia, obra. Tudo que tem valor mas não rende automaticamente."
        />

        <form action={action} className="space-y-5">
          {isEdit ? <input type="hidden" name="id" value={asset.id} /> : null}

          <Field label="Nome" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={asset?.name ?? ""}
              placeholder="Apartamento Centro, Civic 2018, MacBook Pro…"
              autoFocus
            />
            {state?.fieldErrors?.name ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.name}</p>
            ) : null}
          </Field>

          <Field label="Categoria" htmlFor="category" required>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as PhysicalAssetCategory)}
              name="category"
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Descrição" htmlFor="description" hint="Opcional. Detalhes que ajudam a identificar.">
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={asset?.description ?? ""}
              placeholder="Apartamento 70m², 2 quartos, Vila Mariana"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de aquisição" htmlFor="acquiredAt" hint="Opcional">
              <Input
                id="acquiredAt"
                name="acquiredAt"
                type="date"
                defaultValue={asset?.acquired_at ?? ""}
              />
            </Field>
            <Field label="Valor pago" htmlFor="acquiredValue" hint="Opcional">
              <MoneyInput
                id="acquiredValue"
                name="acquiredValue"
                defaultValue={Number(asset?.acquired_value ?? 0)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field
              label="Valor atual"
              htmlFor="currentValue"
              required
              hint="Quanto vale hoje a mercado. Atualize manualmente quando achar relevante."
            >
              <MoneyInput
                id="currentValue"
                name="currentValue"
                defaultValue={Number(asset?.current_value ?? 0)}
              />
              {state?.fieldErrors?.currentValue ? (
                <p className="text-[11.5px] text-rust-600 mt-1">
                  {state.fieldErrors.currentValue}
                </p>
              ) : null}
            </Field>
            <Field label="Moeda" htmlFor="currency">
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
                name="currency"
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar bem"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
