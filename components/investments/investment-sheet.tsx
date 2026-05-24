"use client";

import { useActionState, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInvestment,
  updateInvestment,
  type InvestmentFormState,
} from "@/services/investments.actions";
import type { AssetType, Indexer, TaxRegime, Tables } from "@/types/database";
import type { AssetTemplate } from "@/lib/financial/asset-catalog";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { AssetPicker } from "./asset-picker";

type Investment = Tables<"investments">;
type AccountLite = { id: string; name: string; institution: string };

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "fixed_income_public", label: "Renda fixa · pública" },
  { value: "fixed_income_private", label: "Renda fixa · privada" },
  { value: "fii", label: "FII" },
  { value: "etf", label: "ETF" },
  { value: "stock", label: "Ação" },
  { value: "crypto", label: "Cripto" },
];

const INDEXERS: { value: Indexer; label: string }[] = [
  { value: "selic", label: "Selic" },
  { value: "cdi", label: "CDI" },
  { value: "ipca", label: "IPCA + prefixado" },
  { value: "fixed", label: "Prefixado" },
  { value: "none", label: "Sem indexador" },
];

function investmentToTemplate(inv: Investment): AssetTemplate {
  return {
    ticker: inv.ticker,
    name: inv.name,
    asset_type: inv.asset_type,
    indexer: inv.indexer ?? null,
    indexer_multiplier: inv.indexer_multiplier ?? null,
    fixed_rate: inv.fixed_rate ?? null,
    tax_regime: inv.tax_regime,
    source: "catalog",
  };
}

export function InvestmentSheet({
  open,
  onOpenChange,
  investment,
  investmentAccounts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment?: Investment | null;
  investmentAccounts: AccountLite[];
}) {
  const isEdit = !!investment;

  const [picked, setPicked] = useState<AssetTemplate | null>(
    investment ? investmentToTemplate(investment) : null,
  );
  const [accountId, setAccountId] = useState(
    investment?.account_id ?? investmentAccounts[0]?.id ?? "",
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [state, action, pending] = useActionState<InvestmentFormState | undefined, FormData>(
    isEdit ? updateInvestment : createInvestment,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPicked(investment ? investmentToTemplate(investment) : null);
      setAccountId(investment?.account_id ?? investmentAccounts[0]?.id ?? "");
      setShowAdvanced(false);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Ativo atualizado." : "Ativo cadastrado.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar" : "Novo ativo"}
          title={isEdit ? "Atualizar ativo." : "Adicionar um ativo."}
          description={
            picked
              ? "Confirme os dados de compra e o app cuida do resto."
              : "Digite o ticker ou nome — Tesouros, FIIs, ações e ETFs principais a gente reconhece."
          }
        />

        {investmentAccounts.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">
            Você precisa de pelo menos uma conta do tipo <b>investimento</b> antes de
            cadastrar ativos. Vai em <a className="text-navy-700 dark:text-navy-300" href="/contas">/contas</a>
            {" "}e cria uma corretora (XP, Rico, Inter…).
          </p>
        ) : (
          <form action={action} className="space-y-5">
            {isEdit ? <input type="hidden" name="id" value={investment.id} /> : null}

            <Field label="O que você comprou?" required>
              <AssetPicker
                value={picked}
                onSelect={setPicked}
                onClear={() => setPicked(null)}
                autoFocus={!isEdit}
              />
            </Field>

            {picked ? (
              <>
                {/* Campos hidden carregam os metadados do ativo */}
                <input type="hidden" name="ticker" value={picked.ticker} />
                <input type="hidden" name="name" value={picked.name} />
                <input
                  type="hidden"
                  name="assetType"
                  value={picked.asset_type}
                />
                <input type="hidden" name="indexer" value={picked.indexer ?? ""} />
                <input
                  type="hidden"
                  name="indexerMultiplier"
                  value={picked.indexer_multiplier ?? ""}
                />
                <input
                  type="hidden"
                  name="fixedRate"
                  value={picked.fixed_rate ?? ""}
                />
                <input
                  type="hidden"
                  name="taxRegime"
                  value={picked.tax_regime}
                />

                <Field label="Corretora / custódia" htmlFor="accountId" required>
                  <Select value={accountId} onValueChange={setAccountId} name="accountId">
                    <SelectTrigger id="accountId">
                      <SelectValue placeholder="Conta de investimento" />
                    </SelectTrigger>
                    <SelectContent>
                      {investmentAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.institution}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Data da compra" htmlFor="purchaseDate" required>
                  <Input
                    id="purchaseDate"
                    name="purchaseDate"
                    type="date"
                    defaultValue={
                      investment?.purchase_date ?? new Date().toISOString().slice(0, 10)
                    }
                  />
                </Field>

                {["fii", "stock", "etf", "crypto"].includes(picked.asset_type) ? (
                  <MarketableLotFields
                    investment={investment}
                    assetType={picked.asset_type}
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Valor aplicado" htmlFor="initialAmount" required>
                        <MoneyInput
                          name="initialAmount"
                          id="initialAmount"
                          defaultValue={Number(investment?.initial_amount ?? 0)}
                        />
                      </Field>
                      <Field
                        label="Saldo atual"
                        htmlFor="currentBalance"
                        hint="Se vazio, usa o aplicado"
                      >
                        <MoneyInput
                          name="currentBalance"
                          id="currentBalance"
                          defaultValue={Number(investment?.current_balance ?? 0)}
                        />
                      </Field>
                    </div>
                  </>
                )}

                {!isEdit ? (
                  <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px] text-muted-foreground bg-bone-100 dark:bg-ink-800 border border-border rounded-[8px] px-3 py-2.5">
                    <input
                      type="checkbox"
                      name="debitFromAccount"
                      value="1"
                      defaultChecked
                      className="mt-0.5 accent-navy-700"
                    />
                    <span>
                      <b className="text-foreground">Debitar este valor da conta da corretora.</b>
                      <br />
                      <span className="text-[11.5px]">
                        Cria uma transação de saída automática para evitar dupla contagem no
                        patrimônio total.
                      </span>
                    </span>
                  </label>
                ) : null}

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground font-medium"
                >
                  {showAdvanced ? (
                    <ChevronUp className="w-3 h-3" strokeWidth={1.7} />
                  ) : (
                    <ChevronDown className="w-3 h-3" strokeWidth={1.7} />
                  )}
                  Personalizar dados do ativo
                </button>

                {showAdvanced ? (
                  <AdvancedFields template={picked} onChange={setPicked} />
                ) : null}
              </>
            ) : null}

            {state?.error ? (
              <p className="text-[12.5px] text-rust-600">{state.error}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={pending || !picked}>
                {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar ativo"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ============================== LOTE INICIAL (B3 / cripto) =============== */
function MarketableLotFields({
  investment,
  assetType,
}: {
  investment?: Investment | null;
  assetType: AssetType;
}) {
  const isEdit = !!investment;
  return isEdit ? (
    <div className="rounded-[8px] bg-bone-100 dark:bg-ink-800 border border-border px-3 py-2.5 text-[12.5px] text-muted-foreground">
      Edição do ativo não altera lotes existentes. Use{" "}
      <b className="text-foreground">Novo aporte</b> ou{" "}
      <b className="text-foreground">Venda</b> no menu da linha para registrar
      movimentos.
    </div>
  ) : (
    <LinkedLotInputs assetType={assetType} />
  );
}

/**
 * Três campos vinculados: quantidade, valor total aplicado, preço unitário.
 * Editar qualquer um recalcula os outros. O usuário escolhe a "fonte" de
 * entrada conforme o cenário (registro retroativo usa total; operação
 * recente usa unitário).
 */
function LinkedLotInputs({ assetType }: { assetType: AssetType }) {
  const [quantity, setQuantity] = useState<string>("");
  const [total, setTotal] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  // Marca qual foi o último campo editado pra fonte-da-verdade do recálculo
  const [lastTouched, setLastTouched] = useState<"unit" | "total">("unit");

  const qtyNum = Number(quantity) || 0;
  const unit = assetType === "crypto" ? "unidades" : "cotas";

  // Cuidado: pra evitar loop no MoneyInput uncontrolled, usamos KEY pra remontar
  // o campo "passivo" quando o outro recalcula.

  function handleQtyChange(next: string) {
    setQuantity(next);
    const q = Number(next) || 0;
    if (lastTouched === "unit" && unitPrice > 0) {
      setTotal(Math.round(q * unitPrice * 100) / 100);
    } else if (lastTouched === "total" && total > 0 && q > 0) {
      setUnitPrice(Math.round((total / q) * 10000) / 10000);
    }
  }
  function handleUnitChange(next: number) {
    setUnitPrice(next);
    setLastTouched("unit");
    if (qtyNum > 0) {
      setTotal(Math.round(qtyNum * next * 100) / 100);
    }
  }
  function handleTotalChange(next: number) {
    setTotal(next);
    setLastTouched("total");
    if (qtyNum > 0) {
      setUnitPrice(Math.round((next / qtyNum) * 10000) / 10000);
    }
  }

  return (
    <div className="space-y-3">
      <Field label={`Quantidade (${unit})`} htmlFor="quantity" required>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => handleQtyChange(e.target.value)}
          className="font-mono"
          placeholder={assetType === "crypto" ? "0,12345678" : "100"}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Valor aplicado (total)"
          htmlFor="totalAmount"
          hint="Quanto você gastou no agregado"
        >
          {/* key força remontagem quando total muda externamente */}
          <MoneyInput
            key={`total-${lastTouched === "unit" ? total : "input"}`}
            name="totalAmount"
            id="totalAmount"
            defaultValue={total}
            onValueChange={handleTotalChange}
          />
        </Field>
        <Field
          label="Preço unitário"
          htmlFor="unitPrice"
          hint="Por cota/unidade"
        >
          <MoneyInput
            key={`unit-${lastTouched === "total" ? unitPrice : "input"}`}
            name="unitPrice"
            id="unitPrice"
            defaultValue={unitPrice}
            onValueChange={handleUnitChange}
          />
        </Field>
      </div>

      {qtyNum > 0 && unitPrice > 0 ? (
        <div className="rounded-[8px] bg-bone-100 dark:bg-ink-800 border border-border px-3 py-2 text-[12px] font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Preço médio</span>
            <b className="text-foreground">
              R$ <MoneyMask>{unitPrice.toFixed(assetType === "crypto" ? 6 : 2).replace(".", ",")}</MoneyMask> / {unit.slice(0, -1)}
            </b>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total do lote</span>
            <b className="text-foreground">
              R${" "}
              <MoneyMask>
                {total.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </MoneyMask>
            </b>
          </div>
        </div>
      ) : null}

      <input type="hidden" name="initialAmount" value={total.toFixed(2)} />
    </div>
  );
}

/* ============================== ADVANCED OVERRIDE ======================== */
function AdvancedFields({
  template,
  onChange,
}: {
  template: AssetTemplate;
  onChange: (t: AssetTemplate) => void;
}) {
  return (
    <div className="space-y-4 border-t border-border pt-4 -mt-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" htmlFor="adv-name">
          <Input
            id="adv-name"
            value={template.name}
            onChange={(e) => onChange({ ...template, name: e.target.value })}
          />
        </Field>
        <Field label="Classe">
          <Select
            value={template.asset_type}
            onValueChange={(v) => onChange({ ...template, asset_type: v as AssetType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Indexador">
          <Select
            value={template.indexer ?? "none"}
            onValueChange={(v) => onChange({ ...template, indexer: v as Indexer })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDEXERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Regime fiscal">
          <Select
            value={template.tax_regime}
            onValueChange={(v) => onChange({ ...template, tax_regime: v as TaxRegime })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regressive">IR regressivo</SelectItem>
              <SelectItem value="exempt">Isento</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="% do indexador" hint="1.00 = 100%, 1.10 = 110%">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={template.indexer_multiplier ?? ""}
            onChange={(e) =>
              onChange({
                ...template,
                indexer_multiplier: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="font-mono"
          />
        </Field>
        <Field label="Taxa fixa (% a.a.)" hint="Pra prefixados / IPCA+">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={template.fixed_rate ?? ""}
            onChange={(e) =>
              onChange({
                ...template,
                fixed_rate: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="font-mono"
          />
        </Field>
      </div>
    </div>
  );
}
