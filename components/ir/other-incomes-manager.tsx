"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createOtherIncome,
  deleteOtherIncome,
  type IRFormState,
} from "@/services/ir/actions";
import type { Tables, IROtherIncomeCategory } from "@/types/database";

const CATEGORIES: { value: IROtherIncomeCategory; label: string; help: string }[] = [
  { value: "tributavel_pj", label: "Tributável PJ", help: "Salário, pró-labore, aposentadoria PJ" },
  { value: "tributavel_pf", label: "Tributável PF (carnê-leão)", help: "Aluguel recebido, pensão" },
  { value: "isento", label: "Isento", help: "LCI externo, dividendos, ganhos isentos" },
  { value: "exclusivo_fonte", label: "Exclusivo na fonte", help: "13º, PLR, JCP" },
  { value: "rendimento_acumulado", label: "RRA (rendimento acumulado)", help: "Ações trabalhistas, etc." },
];

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function OtherIncomesManager({
  year,
  incomes,
}: {
  year: number;
  incomes: Tables<"ir_other_incomes">[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [gross, setGross] = useState(0);
  const [irrf, setIrrf] = useState(0);
  const [inss, setInss] = useState(0);
  const [t13, setT13] = useState(0);
  const [state, action, pending] = useActionState<IRFormState | undefined, FormData>(
    createOtherIncome,
    undefined,
  );
  const [delPending, startDelete] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Rendimento adicionado.");
      setShowForm(false);
      setGross(0); setIrrf(0); setInss(0); setT13(0);
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  const handleDelete = async (id: string, desc: string) => {
    const ok = await confirm({
      title: `Remover "${desc}"?`,
      destructive: true,
      confirmLabel: "Remover",
    });
    if (!ok) return;
    startDelete(async () => {
      const r = await deleteOtherIncome(id, year);
      if (r.error) toast.error(r.error);
      else toast.success("Removido.");
    });
  };

  return (
    <div>
      {incomes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic mb-4">
          Adicione aqui rendimentos que NÃO estão registrados no app — salário
          CLT pago em conta de fora, freelance esporádico, resgate de PGBL etc.
        </p>
      ) : (
        <table className="w-full text-[12.5px] mb-4">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th className="text-left pb-2 font-medium">Categoria</th>
              <th className="text-left pb-2 font-medium">Descrição / Fonte</th>
              <th className="text-right pb-2 font-medium">Bruto</th>
              <th className="text-right pb-2 font-medium">IRRF</th>
              <th className="text-right pb-2 font-medium">INSS</th>
              <th className="text-right pb-2 font-medium">13º</th>
              <th className="text-right pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {incomes.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="py-2 text-faint-foreground text-[11.5px]">
                  {CATEGORIES.find((c) => c.value === i.category)?.label ?? i.category}
                </td>
                <td className="py-2">
                  <div className="text-foreground">{i.description}</div>
                  <div className="text-faint-foreground text-[11px]">
                    {i.source_name}{i.source_cnpj_cpf ? ` · ${i.source_cnpj_cpf}` : ""}
                  </div>
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {i.currency !== "BRL" ? <span className="text-faint-foreground text-[10.5px]">{i.currency} </span> : "R$ "}
                  {fmtBRL(Number(i.gross_amount))}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-faint-foreground">R$ {fmtBRL(Number(i.irrf_amount))}</td>
                <td className="py-2 text-right font-mono tabular-nums text-faint-foreground">R$ {fmtBRL(Number(i.inss_amount))}</td>
                <td className="py-2 text-right font-mono tabular-nums text-faint-foreground">R$ {fmtBRL(Number(i.thirteenth_amount))}</td>
                <td className="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(i.id, i.description)}
                    disabled={delPending}
                    aria-label="Remover"
                    className="text-rust-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm ? (
        <form action={action} className="border-t border-border pt-4 space-y-3">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="gross_amount" value={gross} />
          <input type="hidden" name="irrf_amount" value={irrf} />
          <input type="hidden" name="inss_amount" value={inss} />
          <input type="hidden" name="thirteenth_amount" value={t13} />
          <div className="grid lg:grid-cols-3 gap-3">
            <Field label="Categoria" htmlFor="category" required>
              <Select name="category" defaultValue="tributavel_pj">
                <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descrição" htmlFor="description" required>
              <Input id="description" name="description" required placeholder="Salário Empresa X" />
            </Field>
            <Field label="Fonte pagadora" htmlFor="source_name" required>
              <Input id="source_name" name="source_name" required placeholder="Empresa X Ltda" />
            </Field>
          </div>
          <div className="grid lg:grid-cols-2 gap-3">
            <Field label="CNPJ/CPF fonte" htmlFor="source_cnpj_cpf">
              <Input id="source_cnpj_cpf" name="source_cnpj_cpf" />
            </Field>
            <Field label="Moeda" htmlFor="currency">
              <Select name="currency" defaultValue="BRL">
                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ BRL</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="USD">US$ USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid lg:grid-cols-4 gap-3">
            <Field label="Bruto" htmlFor="gross-input" required>
              <MoneyInput name="gross-input" defaultValue={0} onValueChange={setGross} />
            </Field>
            <Field label="IRRF retido" htmlFor="irrf-input">
              <MoneyInput name="irrf-input" defaultValue={0} onValueChange={setIrrf} />
            </Field>
            <Field label="INSS" htmlFor="inss-input">
              <MoneyInput name="inss-input" defaultValue={0} onValueChange={setInss} />
            </Field>
            <Field label="13º (líquido)" htmlFor="t13-input">
              <MoneyInput name="t13-input" defaultValue={0} onValueChange={setT13} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : "Adicionar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
          Adicionar rendimento manual
        </Button>
      )}
    </div>
  );
}
