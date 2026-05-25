"use client";

import { useActionState, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import type { Currency, MarriageRegime, PhysicalAssetCategory, Tables } from "@/types/database";
import { CATEGORY_LABELS } from "@/lib/financial/asset-categories";
import { FilerPicker } from "@/components/ir/filer-picker";
import { ExcludeFromIrToggle } from "@/components/ir/exclude-from-ir-toggle";

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
  filers = [],
  regime = "solteiro",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset?: Asset | null;
  defaultCategory?: PhysicalAssetCategory;
  filers?: Tables<"ir_filers">[];
  regime?: MarriageRegime;
}) {
  const isEdit = !!asset;
  const [category, setCategory] = useState<PhysicalAssetCategory>(
    asset?.category ?? defaultCategory ?? "other",
  );
  const [currency, setCurrency] = useState<Currency>(asset?.currency ?? "BRL");
  // IR collapse aberto por padrão se já tem dados preenchidos (edit)
  const [showIR, setShowIR] = useState<boolean>(
    !!(asset?.registration_number || asset?.address || asset?.brand),
  );

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
      setShowIR(!!(asset?.registration_number || asset?.address || asset?.brand));
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

          {/* Identificação Receita — só faz sentido pra imóveis e veículos */}
          {category === "real_estate" || category === "vehicle" ? (
            <>
              <button
                type="button"
                onClick={() => setShowIR((v) => !v)}
                className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground font-medium"
              >
                {showIR ? (
                  <ChevronUp className="w-3 h-3" strokeWidth={1.7} />
                ) : (
                  <ChevronDown className="w-3 h-3" strokeWidth={1.7} />
                )}
                Identificação Receita (IRPF)
                <span className="text-[10.5px] font-mono text-faint-foreground ml-1">
                  · {category === "real_estate" ? "imóvel" : "veículo"}
                </span>
              </button>

              {showIR ? (
                category === "real_estate" ? (
                  <RealEstateIRFields asset={asset} />
                ) : (
                  <VehicleIRFields asset={asset} />
                )
              ) : null}
            </>
          ) : null}

          {filers.length >= 2 ? (
            <details className="text-[12.5px] text-muted-foreground">
              <summary className="cursor-pointer font-medium hover:text-foreground">
                Titular do bem (IRPF) <span className="text-faint-foreground">· quem declara</span>
              </summary>
              <div className="pt-3">
                <FilerPicker
                  filers={filers}
                  regime={regime}
                  defaultOwnerFilerId={asset?.owner_filer_id}
                  defaultIsParticular={asset?.is_particular}
                  defaultParticularReason={asset?.particular_reason}
                />
              </div>
            </details>
          ) : null}

          <ExcludeFromIrToggle defaultValue={asset?.exclude_from_ir ?? false} />

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

/* ============================== IR: IMÓVEL ================================ */
function RealEstateIRFields({ asset }: { asset?: Asset | null }) {
  return (
    <div className="space-y-3 border-t border-border pt-4 -mt-1">
      <Field label="Endereço completo" htmlFor="address" hint="Logradouro, número, bairro, cidade/UF">
        <Textarea
          id="address"
          name="address"
          rows={2}
          defaultValue={asset?.address ?? ""}
          placeholder="Rua das Flores, 123 · apto 45 · Vila Mariana · São Paulo/SP · CEP 04102-000"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Matrícula" htmlFor="registrationNumber" hint="Nº da matrícula no Registro de Imóveis">
          <Input
            id="registrationNumber"
            name="registrationNumber"
            defaultValue={asset?.registration_number ?? ""}
            placeholder="123.456"
            className="font-mono"
          />
        </Field>
        <Field label="Cartório" htmlFor="registryOffice" hint="Cartório onde está registrado">
          <Input
            id="registryOffice"
            name="registryOffice"
            defaultValue={asset?.registry_office ?? ""}
            placeholder="2º Cartório de RI de São Paulo"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Inscrição IPTU" htmlFor="iptuRegistration">
          <Input
            id="iptuRegistration"
            name="iptuRegistration"
            defaultValue={asset?.iptu_registration ?? ""}
            placeholder="012.345.678-9"
            className="font-mono"
          />
        </Field>
        <Field label="Área (m²)" htmlFor="areaSqm">
          <Input
            id="areaSqm"
            name="areaSqm"
            type="number"
            step="0.01"
            min="0"
            defaultValue={asset?.area_sqm ?? ""}
            placeholder="70"
            className="font-mono"
          />
        </Field>
        <Field label="% propriedade" htmlFor="ownershipPercent" hint="100 = só seu">
          <Input
            id="ownershipPercent"
            name="ownershipPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={asset?.ownership_percent ?? ""}
            placeholder="100"
            className="font-mono"
          />
        </Field>
      </div>
    </div>
  );
}

/* ============================== IR: VEÍCULO =============================== */
function VehicleIRFields({ asset }: { asset?: Asset | null }) {
  return (
    <div className="space-y-3 border-t border-border pt-4 -mt-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca" htmlFor="brand" hint="Honda, VW, Kawasaki…">
          <Input
            id="brand"
            name="brand"
            defaultValue={asset?.brand ?? ""}
            placeholder="Kawasaki"
          />
        </Field>
        <Field label="Modelo" htmlFor="model">
          <Input
            id="model"
            name="model"
            defaultValue={asset?.model ?? ""}
            placeholder="Ninja 400"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Ano fabricação" htmlFor="manufactureYear">
          <Input
            id="manufactureYear"
            name="manufactureYear"
            type="number"
            min="1900"
            max="2100"
            defaultValue={asset?.manufacture_year ?? ""}
            placeholder="2022"
            className="font-mono"
          />
        </Field>
        <Field label="Placa" htmlFor="licensePlate">
          <Input
            id="licensePlate"
            name="licensePlate"
            defaultValue={asset?.license_plate ?? ""}
            placeholder="ABC1D23"
            className="font-mono uppercase"
            maxLength={8}
          />
        </Field>
        <Field label="RENAVAM" htmlFor="registrationNumber" hint="11 dígitos">
          <Input
            id="registrationNumber"
            name="registrationNumber"
            defaultValue={asset?.registration_number ?? ""}
            placeholder="00123456789"
            className="font-mono"
            maxLength={11}
          />
        </Field>
      </div>
    </div>
  );
}
