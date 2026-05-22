"use client";

import { useActionState, useEffect, useState } from "react";
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
import type { AssetType, Indexer, Tables } from "@/types/database";

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
  const [accountId, setAccountId] = useState(investment?.account_id ?? investmentAccounts[0]?.id ?? "");
  const [assetType, setAssetType] = useState<AssetType>(investment?.asset_type ?? "fixed_income_public");
  const [indexer, setIndexer] = useState<Indexer>(investment?.indexer ?? "selic");
  const [taxRegime, setTaxRegime] = useState<"regressive" | "exempt">(
    investment?.tax_regime ?? "regressive",
  );

  const [state, action, pending] = useActionState<InvestmentFormState | undefined, FormData>(
    isEdit ? updateInvestment : createInvestment,
    undefined,
  );

  // Reset state em open (padrão React 19)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAccountId(investment?.account_id ?? investmentAccounts[0]?.id ?? "");
      setAssetType(investment?.asset_type ?? "fixed_income_public");
      setIndexer(investment?.indexer ?? "selic");
      setTaxRegime(investment?.tax_regime ?? "regressive");
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
          description="Ações, FIIs, Tesouro, CDB — o que estiver em alguma corretora ou onde o dinheiro rende."
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
              <Field label="Ticker" htmlFor="ticker" required>
                <Input
                  id="ticker"
                  name="ticker"
                  defaultValue={investment?.ticker ?? ""}
                  placeholder="MXRF11, Tesouro Selic 2031…"
                />
              </Field>
              <Field label="Nome" htmlFor="name" required>
                <Input
                  id="name"
                  name="name"
                  defaultValue={investment?.name ?? ""}
                  placeholder="Apelido descritivo"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Classe" htmlFor="assetType" required>
                <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)} name="assetType">
                  <SelectTrigger id="assetType">
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
              <Field label="Indexador" htmlFor="indexer">
                <Select value={indexer} onValueChange={(v) => setIndexer(v as Indexer)} name="indexer">
                  <SelectTrigger id="indexer">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="% do indexador"
                htmlFor="indexerMultiplier"
                hint="1.00 = 100%; 1.10 = 110% do CDI"
              >
                <Input
                  id="indexerMultiplier"
                  name="indexerMultiplier"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={investment?.indexer_multiplier ?? 1}
                  className="font-mono"
                />
              </Field>
              <Field label="Taxa fixa (% a.a.)" htmlFor="fixedRate" hint="Pra prefixados">
                <Input
                  id="fixedRate"
                  name="fixedRate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={investment?.fixed_rate ?? ""}
                  className="font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data da compra" htmlFor="purchaseDate" required>
                <Input
                  id="purchaseDate"
                  name="purchaseDate"
                  type="date"
                  defaultValue={investment?.purchase_date ?? new Date().toISOString().slice(0, 10)}
                />
              </Field>
              <Field label="Regime fiscal" htmlFor="taxRegime">
                <Select value={taxRegime} onValueChange={(v) => setTaxRegime(v as "regressive" | "exempt")} name="taxRegime">
                  <SelectTrigger id="taxRegime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regressive">IR regressivo</SelectItem>
                    <SelectItem value="exempt">Isento (LCI, LCA, FII, etc.)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor aplicado" htmlFor="initialAmount" required>
                <MoneyInput
                  name="initialAmount"
                  id="initialAmount"
                  defaultValue={Number(investment?.initial_amount ?? 0)}
                />
              </Field>
              <Field label="Saldo atual" htmlFor="currentBalance" hint="Se vazio, usa o aplicado">
                <MoneyInput
                  name="currentBalance"
                  id="currentBalance"
                  defaultValue={Number(investment?.current_balance ?? investment?.initial_amount ?? 0)}
                />
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
                {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar ativo"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
