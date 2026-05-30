"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createCarneLeao,
  deleteCarneLeao,
  markCarneLeaoPaid,
} from "@/services/ir/carne-leao.actions";
import type { IRFormState } from "@/services/ir/actions";
import type { Tables, CarneLeaoKind } from "@/types/database";

const KIND_LABELS: Record<CarneLeaoKind, string> = {
  aluguel: "Aluguel recebido",
  freelance_pf: "Freelance PF",
  pensao_recebida: "Pensão recebida",
  exterior_trabalho: "Trabalho no exterior",
  outros: "Outros",
};

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function CarneLeaoManager({
  year,
  entries,
}: {
  year: number;
  entries: Tables<"carne_leao_mensal">[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [gross, setGross] = useState(0);
  const [deductible, setDeductible] = useState(0);
  const [state, action, pending] = useActionState<IRFormState | undefined, FormData>(
    createCarneLeao,
    undefined,
  );
  const [opPending, startOp] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Registrado.");
      setShowForm(false);
      setGross(0); setDeductible(0);
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
    startOp(async () => {
      const r = await deleteCarneLeao(id, year);
      if (r.error) toast.error(r.error);
      else toast.success("Removido.");
    });
  };

  const handleMarkPaid = async (id: string) => {
    startOp(async () => {
      const r = await markCarneLeaoPaid({
        id,
        paidAt: new Date().toISOString(),
        year,
      });
      if (r.error) toast.error(r.error);
      else toast.success("Marcado como pago.");
    });
  };

  const totalGross = entries.reduce((s, e) => s + Number(e.gross_amount), 0);
  const totalTax = entries.reduce((s, e) => s + Number(e.tax_due), 0);
  const totalPending = entries
    .filter((e) => !e.paid_at)
    .reduce((s, e) => s + Number(e.tax_due), 0);

  return (
    <div>
      {entries.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4 text-[12px]">
            <Stat label="Recebido no ano" value={totalGross} />
            <Stat label="Imposto devido" value={totalTax} />
            <Stat
              label="Pendente"
              value={totalPending}
              negative={totalPending > 0}
            />
          </div>

          <p className="text-[11.5px] text-gold-700 dark:text-gold-500 bg-gold-100/50 dark:bg-gold-700/15 border border-gold-600/30 rounded-[6px] px-2.5 py-2 mb-4">
            ⚠ Esta aba calcula só o <b>imposto mensal (DARF 0190)</b>. Esses
            rendimentos também precisam constar na sua declaração anual: lance-os
            em <b>Rendimentos tributáveis recebidos de PF</b> (aba Rendimentos)
            pra entrarem na base do ajuste. O imposto pago aqui é antecipação.
          </p>

          <table className="w-full text-[12.5px] mb-4">
            <thead>
              <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
                <th className="text-left pb-2 font-medium">Mês</th>
                <th className="text-left pb-2 font-medium">Tipo</th>
                <th className="text-left pb-2 font-medium">Descrição</th>
                <th className="text-right pb-2 font-medium">Bruto</th>
                <th className="text-right pb-2 font-medium">DARF</th>
                <th className="text-left pb-2 font-medium">Vence</th>
                <th className="text-right pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isOverdue = e.due_date && !e.paid_at && new Date(e.due_date) < new Date();
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-2 font-mono text-foreground">
                      {MONTH_LABELS[e.month - 1]}
                    </td>
                    <td className="py-2 text-faint-foreground">
                      {KIND_LABELS[e.kind]}
                    </td>
                    <td className="py-2 text-foreground">{e.description}</td>
                    <td className="py-2 font-mono text-right tabular-nums">
                      R$ {fmtBRL(Number(e.gross_amount))}
                    </td>
                    <td className="py-2 font-mono text-right tabular-nums text-foreground font-medium">
                      R$ {fmtBRL(Number(e.tax_due))}
                    </td>
                    <td className="py-2 font-mono text-[11px]">
                      {e.due_date ? e.due_date.split("-").reverse().join("/") : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {e.paid_at ? (
                        <Badge tone="olive">pago</Badge>
                      ) : (
                        <div className="flex justify-end gap-1">
                          {isOverdue ? (
                            <Badge tone="rust">
                              <AlertCircle className="w-3 h-3 inline mr-0.5" strokeWidth={2} />
                              atrasado
                            </Badge>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkPaid(e.id)}
                            disabled={opPending}
                          >
                            <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(e.id, e.description)}
                            disabled={opPending}
                            className="text-rust-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground italic mb-4">
          Carnê-leão: imposto mensal pra rendimentos recebidos de PF (aluguel,
          freelance). Vence no último dia útil do mês seguinte. Não pagar gera
          multa de 0,33%/dia + juros Selic.
        </p>
      )}

      {showForm ? (
        <form action={action} className="border-t border-border pt-4 space-y-3">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="gross_amount" value={gross} />
          <input type="hidden" name="deductible_expenses" value={deductible} />
          <div className="grid lg:grid-cols-3 gap-3">
            <Field label="Mês" htmlFor="month" required>
              <Select name="month" defaultValue={String(new Date().getMonth() + 1)}>
                <SelectTrigger id="month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((l, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{l}/{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="kind" required>
              <Select name="kind" defaultValue="aluguel">
                <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as CarneLeaoKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descrição" htmlFor="description" required>
              <Input id="description" name="description" required placeholder="Aluguel Vila Olímpia" />
            </Field>
          </div>
          <div className="grid lg:grid-cols-2 gap-3">
            <Field label="Pago por (nome)" htmlFor="source_name">
              <Input id="source_name" name="source_name" />
            </Field>
            <Field label="CPF/CNPJ" htmlFor="source_cpf_cnpj">
              <Input id="source_cpf_cnpj" name="source_cpf_cnpj" />
            </Field>
          </div>
          <div className="grid lg:grid-cols-2 gap-3">
            <Field label="Valor bruto" htmlFor="gross-input" required>
              <MoneyInput name="gross-input" defaultValue={0} onValueChange={setGross} />
            </Field>
            <Field label="Despesas dedutíveis" htmlFor="ded-input" hint="condomínio, IPTU (pra aluguel)">
              <MoneyInput name="ded-input" defaultValue={0} onValueChange={setDeductible} />
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
          Adicionar carnê-leão
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
        {label}
      </div>
      <div className={"font-mono text-[15px] tabular-nums mt-1 " + (negative ? "text-rust-600" : "text-foreground")}>
        R$ {fmtBRL(value)}
      </div>
    </div>
  );
}
