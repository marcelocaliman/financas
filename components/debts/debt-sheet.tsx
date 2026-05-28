"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  createDebt,
  updateDebt,
  type DebtFormState,
} from "@/services/debts.actions";
import { DEBT_KIND_LABELS } from "@/lib/financial/debt-labels";
import { FilerPickerWithOwnership } from "@/components/ir/filer-picker";
import type { Currency, DebtKind, MarriageRegime, Tables } from "@/types/database";

type Debt = Tables<"debts">;
type Filer = Tables<"ir_filers">;
type Asset = Pick<Tables<"physical_assets">, "id" | "name" | "category">;

export function DebtSheet({
  open,
  onOpenChange,
  debt,
  assets = [],
  filers = [],
  regime = "solteiro",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  debt?: Debt | null;
  assets?: Asset[];
  filers?: Filer[];
  regime?: MarriageRegime;
}) {
  const isEdit = !!debt;
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? "financiamento_imovel");
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? "BRL");
  const [physicalAssetId, setPhysicalAssetId] = useState<string>(
    debt?.physical_asset_id ?? "",
  );

  const [state, action, pending] = useActionState<DebtFormState | undefined, FormData>(
    isEdit ? updateDebt : createDebt,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setKind(debt?.kind ?? "financiamento_imovel");
      setCurrency(debt?.currency ?? "BRL");
      setPhysicalAssetId(debt?.physical_asset_id ?? "");
    }
  }

  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Dívida atualizada." : "Dívida cadastrada.");
      onOpenChange(false);
      router.refresh();
    }
  }, [state, isEdit, onOpenChange, router]);

  const linkableAssets = assets.filter((a) =>
    kind === "financiamento_imovel"
      ? a.category === "real_estate"
      : kind === "financiamento_veiculo"
        ? a.category === "vehicle"
        : true,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar dívida" : "Nova dívida"}
          title={isEdit ? "Atualizar dívida." : "Cadastrar dívida ou ônus real."}
          description="Financiamentos, empréstimos, consignados. A Receita exige declarar saldo em 31/12 quando > R$ 5.000."
        />

        <form action={action} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={debt.id} /> : null}

          <Field label="Tipo" htmlFor="kind" required>
            <Select value={kind} onValueChange={(v) => setKind(v as DebtKind)} name="kind">
              <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DEBT_KIND_LABELS) as DebtKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{DEBT_KIND_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Descrição" htmlFor="description" required>
            <Input
              id="description"
              name="description"
              defaultValue={debt?.description ?? ""}
              placeholder="Financiamento Itaú apto Vila Mariana"
              autoFocus={!isEdit}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Credor" htmlFor="creditorName" required>
              <Input
                id="creditorName"
                name="creditorName"
                defaultValue={debt?.creditor_name ?? ""}
                placeholder="Itaú Unibanco"
              />
            </Field>
            <Field label="CNPJ/CPF do credor" htmlFor="creditorCnpjCpf">
              <Input
                id="creditorCnpjCpf"
                name="creditorCnpjCpf"
                defaultValue={debt?.creditor_cnpj_cpf ?? ""}
                placeholder="00.000.000/0000-00"
                className="font-mono"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor original" htmlFor="originalAmount">
              <MoneyInput
                id="originalAmount"
                name="originalAmount"
                defaultValue={Number(debt?.original_amount ?? 0)}
              />
            </Field>
            <Field label="Saldo em 31/12" htmlFor="currentBalance" required>
              <MoneyInput
                id="currentBalance"
                name="currentBalance"
                defaultValue={Number(debt?.current_balance ?? 0)}
              />
            </Field>
          </div>

          <Field label="Moeda" htmlFor="currency">
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)} name="currency">
              <SelectTrigger id="currency" className="max-w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">R$ BRL</SelectItem>
                <SelectItem value="EUR">€ EUR</SelectItem>
                <SelectItem value="USD">US$ USD</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Data contrato" htmlFor="contractDate">
              <Input id="contractDate" name="contractDate" type="date" defaultValue={debt?.contract_date ?? ""} />
            </Field>
            <Field label="Vencimento final" htmlFor="endDate">
              <Input id="endDate" name="endDate" type="date" defaultValue={debt?.end_date ?? ""} />
            </Field>
            <Field label="Juros (% a.a.)" htmlFor="interestRate">
              <Input
                id="interestRate"
                name="interestRate"
                type="number"
                step="0.01"
                defaultValue={debt?.interest_rate ?? ""}
                className="font-mono"
              />
            </Field>
          </div>

          {linkableAssets.length > 0 ? (
            <Field
              label="Bem atrelado (opcional)"
              htmlFor="physicalAssetId"
              hint="Pra financiamento de imóvel/veículo — liga ao bem físico cadastrado"
            >
              <Select
                value={physicalAssetId || "none"}
                onValueChange={(v) => setPhysicalAssetId(v === "none" ? "" : v)}
              >
                <SelectTrigger id="physicalAssetId"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nenhum</SelectItem>
                  {linkableAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="physicalAssetId" value={physicalAssetId} />
            </Field>
          ) : null}

          <Field label="Notas" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} defaultValue={debt?.notes ?? ""} />
          </Field>

          {filers.length >= 2 ? (
            <details className="text-[12.5px] text-muted-foreground">
              <summary className="cursor-pointer font-medium hover:text-foreground">
                Titular da dívida (IRPF)
              </summary>
              <div className="pt-3">
                <FilerPickerWithOwnership
                  filers={filers}
                  regime={regime}
                  defaultOwnerFilerId={debt?.owner_filer_id}
                  defaultIsParticular={debt?.is_particular}
                  defaultParticularReason={debt?.particular_reason}
                  defaultOwnershipPercent={debt?.ownership_percent}
                />
              </div>
            </details>
          ) : null}

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
