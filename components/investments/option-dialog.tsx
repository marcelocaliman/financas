"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  type InvestmentFormState,
} from "@/services/investments.actions";
import type { OptionType, OptionPosition } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string };

/**
 * Dialog dedicado pra cadastrar opções (calls/puts).
 *
 * Opções têm campos muito diferentes de ações: strike, vencimento, posição
 * (lançada/comprada). Ter form separado evita poluir o InvestmentSheet
 * principal.
 */
export function OptionDialog({
  open,
  onOpenChange,
  investmentAccounts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investmentAccounts: AccountLite[];
}) {
  const [ticker, setTicker] = useState("");
  const [underlyingTicker, setUnderlyingTicker] = useState("");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [position, setPosition] = useState<OptionPosition>("covered");
  const [strike, setStrike] = useState(0);
  const [premium, setPremium] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [accountId, setAccountId] = useState(investmentAccounts[0]?.id ?? "");
  const [tradeDate, setTradeDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [expiryDate, setExpiryDate] = useState("");
  const [debitFromAccount, setDebitFromAccount] = useState(true);

  const [state, action, pending] = useActionState<InvestmentFormState | undefined, FormData>(
    createInvestment,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Opção cadastrada.");
      onOpenChange(false);
      // Reset form
      setTicker("");
      setUnderlyingTicker("");
      setStrike(0);
      setPremium(0);
      setQuantity("");
      setExpiryDate("");
    }
    if (state?.error) toast.error(state.error);
  }, [state, onOpenChange]);

  const qtyNum = Number(quantity) || 0;
  const total = qtyNum * premium;

  const isLanced = position === "covered" || position === "naked";

  // Pra opção lançada, o "preço de compra" é negativo (você RECEBE prêmio).
  // No banco salvamos como buy normal e o premium vira initial_amount.
  // Quando expirar/exercer/recomprar, calculamos lucro/prejuízo na renda-variavel.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader
          eyebrow="Nova opção"
          title={
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
              Cadastrar opção
            </span>
          }
          description="Calls e puts da B3. O app calcula lucro/prejuízo no vencimento ou na recompra, e DARF automático no mês."
        />

        <form action={action} className="space-y-4">
          {/* Hidden fields obrigatórios pra createInvestment */}
          <input type="hidden" name="assetType" value="option" />
          <input type="hidden" name="ticker" value={ticker} />
          <input type="hidden" name="name" value={ticker} />
          <input type="hidden" name="taxRegime" value="regressive" />
          <input type="hidden" name="purchaseDate" value={tradeDate} />
          <input type="hidden" name="quantity" value={qtyNum} />
          <input type="hidden" name="unitPrice" value={premium} />
          <input type="hidden" name="initialAmount" value={total} />
          <input type="hidden" name="optionType" value={optionType} />
          <input type="hidden" name="strikePrice" value={strike} />
          <input type="hidden" name="expiryDate" value={expiryDate} />
          <input type="hidden" name="underlyingTicker" value={underlyingTicker.toUpperCase()} />
          <input type="hidden" name="optionPosition" value={position} />
          <input type="hidden" name="debitFromAccount" value={debitFromAccount ? "1" : "0"} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Corretora" htmlFor="accountId" required>
              <Select value={accountId} onValueChange={setAccountId} name="accountId">
                <SelectTrigger id="accountId"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {investmentAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.institution}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Posição" htmlFor="position" required>
              <Select value={position} onValueChange={(v) => setPosition(v as OptionPosition)}>
                <SelectTrigger id="position"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="covered">Lançada coberta (vendi com ações)</SelectItem>
                  <SelectItem value="naked">Lançada descoberta</SelectItem>
                  <SelectItem value="long">Comprada (paguei prêmio)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker da opção" htmlFor="ticker" required hint="PETRC60, MGLU100 etc">
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                required
                className="font-mono"
              />
            </Field>
            <Field label="Ativo subjacente" htmlFor="underlying" hint="PETR4, MGLU3 etc">
              <Input
                id="underlying"
                value={underlyingTicker}
                onChange={(e) => setUnderlyingTicker(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" htmlFor="optionType" required>
              <Select value={optionType} onValueChange={(v) => setOptionType(v as OptionType)}>
                <SelectTrigger id="optionType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call (direito de compra)</SelectItem>
                  <SelectItem value="put">Put (direito de venda)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Strike (preço de exercício)" htmlFor="strike" required>
              <MoneyInput name="strike-input" defaultValue={0} onValueChange={setStrike} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da operação" htmlFor="tradeDate" required>
              <Input
                id="tradeDate"
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Vencimento" htmlFor="expiryDate" required hint="3a sexta-feira do mês">
              <Input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade" htmlFor="qty" required hint="1 contrato = 100 ações na B3">
              <Input
                id="qty"
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </Field>
            <Field
              label={isLanced ? "Prêmio recebido (un)" : "Prêmio pago (un)"}
              htmlFor="premium"
              required
            >
              <MoneyInput name="premium-input" defaultValue={0} onValueChange={setPremium} />
            </Field>
          </div>

          {total > 0 ? (
            <div className="rounded-[8px] border border-navy-700/20 bg-navy-700/5 p-3 text-[12.5px]">
              <div className="font-mono text-foreground">
                Total:{" "}
                <b>
                  R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </b>{" "}
                ({isLanced ? "recebido" : "pago"})
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-1">
                {isLanced
                  ? "Vai pra conta. No vencimento sem exercício: lucro 100%."
                  : "Sai da conta. No vencimento sem exercício: prejuízo 100%."}
              </div>
            </div>
          ) : null}

          <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px] text-muted-foreground bg-bone-100 dark:bg-ink-800 border border-border rounded-[8px] px-3 py-2.5">
            <input
              type="checkbox"
              checked={debitFromAccount}
              onChange={(e) => setDebitFromAccount(e.target.checked)}
              className="mt-0.5 accent-navy-700"
            />
            <span>
              <b className="text-foreground">
                {isLanced ? "Creditar" : "Debitar"} este valor da conta
              </b>
              <br />
              <span className="text-[11.5px]">
                {isLanced
                  ? "Marca entrada do prêmio recebido."
                  : "Marca saída do prêmio pago."}
              </span>
            </span>
          </label>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || !ticker || !strike || !expiryDate || qtyNum <= 0}
            >
              {pending ? "Salvando…" : "Cadastrar opção"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
