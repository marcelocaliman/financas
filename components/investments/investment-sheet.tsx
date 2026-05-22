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
            cadastrar ativos. Vai em <a className="text-navy-700" href="/contas">/contas</a>
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

                <div className="grid grid-cols-2 gap-3">
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
                  <Field label="Valor aplicado" htmlFor="initialAmount" required>
                    <MoneyInput
                      name="initialAmount"
                      id="initialAmount"
                      defaultValue={Number(investment?.initial_amount ?? 0)}
                    />
                  </Field>
                </div>

                <Field
                  label="Saldo atual (opcional)"
                  htmlFor="currentBalance"
                  hint="Se vazio, usa o aplicado. Atualizado automaticamente todo dia pra ativos Selic/CDI."
                >
                  <MoneyInput
                    name="currentBalance"
                    id="currentBalance"
                    defaultValue={Number(investment?.current_balance ?? 0)}
                  />
                </Field>

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
