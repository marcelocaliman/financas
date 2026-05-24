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
  createDeductiblePayment,
  deleteDeductiblePayment,
  type IRFormState,
} from "@/services/ir/actions";
import type { Tables, IRDeductibleKind } from "@/types/database";

const KINDS: { value: IRDeductibleKind; label: string }[] = [
  { value: "plano_saude", label: "Plano de saúde" },
  { value: "hospital", label: "Hospital / exames" },
  { value: "medico", label: "Médico" },
  { value: "dentista", label: "Dentista" },
  { value: "psicologo", label: "Psicólogo" },
  { value: "outros_saude", label: "Outros saúde" },
  { value: "educacao_titular", label: "Educação titular" },
  { value: "educacao_dependente", label: "Educação dependente" },
  { value: "inss_titular", label: "INSS titular" },
  { value: "inss_domestico", label: "INSS doméstico" },
  { value: "pgbl", label: "PGBL" },
  { value: "previdencia_privada", label: "Previdência privada" },
  { value: "pensao_alimenticia", label: "Pensão alimentícia" },
  { value: "doacao_eca", label: "Doação ECA" },
  { value: "doacao_cultural", label: "Doação cultural" },
  { value: "outros", label: "Outros" },
];

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function DeductiblesManager({
  year,
  payments,
}: {
  year: number;
  payments: Tables<"ir_deductible_payments">[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState(0);
  const [state, action, pending] = useActionState<IRFormState | undefined, FormData>(
    createDeductiblePayment,
    undefined,
  );
  const [delPending, startDelete] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Pagamento adicionado.");
      setShowForm(false);
      setAmount(0);
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
      const r = await deleteDeductiblePayment(id, year);
      if (r.error) toast.error(r.error);
      else toast.success("Removido.");
    });
  };

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      {payments.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic mb-4">
          Nenhum pagamento dedutível cadastrado pra {year}. Saúde não tem limite;
          educação tem (R$ 3.561,50 por pessoa); PGBL tem (12% da renda tributável).
        </p>
      ) : (
        <table className="w-full text-[12.5px] mb-4">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th className="text-left pb-2 font-medium">Tipo</th>
              <th className="text-left pb-2 font-medium">Descrição</th>
              <th className="text-left pb-2 font-medium">Beneficiário</th>
              <th className="text-left pb-2 font-medium">Pago a</th>
              <th className="text-right pb-2 font-medium">Valor</th>
              <th className="text-right pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2 text-faint-foreground text-[11.5px]">
                  {KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}
                </td>
                <td className="py-2 text-foreground">{p.description}</td>
                <td className="py-2 text-muted-foreground">{p.beneficiary ?? "—"}</td>
                <td className="py-2 text-faint-foreground">
                  {p.recipient_name}
                  {p.recipient_cnpj_cpf ? (
                    <div className="font-mono text-[11px]">{p.recipient_cnpj_cpf}</div>
                  ) : null}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {p.currency !== "BRL" ? <span className="text-faint-foreground text-[10.5px]">{p.currency} </span> : "R$ "}
                  {fmtBRL(Number(p.amount))}
                </td>
                <td className="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(p.id, p.description)}
                    disabled={delPending}
                    aria-label="Remover"
                    className="text-rust-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                  </Button>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border-strong">
              <td colSpan={4} className="pt-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground">
                Total
              </td>
              <td className="pt-2.5 text-right font-mono tabular-nums text-foreground font-medium">
                R$ {fmtBRL(total)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      )}

      {showForm ? (
        <form action={action} className="border-t border-border pt-4 space-y-3">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="amount" value={amount} />
          <div className="grid lg:grid-cols-3 gap-3">
            <Field label="Tipo" htmlFor="kind" required>
              <Select name="kind" defaultValue="plano_saude">
                <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descrição" htmlFor="description" required>
              <Input id="description" name="description" required placeholder="Plano Unimed Família" />
            </Field>
            <Field label="Data" htmlFor="payment_date">
              <Input id="payment_date" name="payment_date" type="date" />
            </Field>
          </div>
          <div className="grid lg:grid-cols-3 gap-3">
            <Field label="Pago a (nome)" htmlFor="recipient_name" required>
              <Input id="recipient_name" name="recipient_name" required placeholder="Unimed BH" />
            </Field>
            <Field label="CNPJ/CPF" htmlFor="recipient_cnpj_cpf">
              <Input id="recipient_cnpj_cpf" name="recipient_cnpj_cpf" placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Beneficiário" htmlFor="beneficiary" hint="Dependente atendido (saúde/educação)">
              <Input id="beneficiary" name="beneficiary" />
            </Field>
          </div>
          <div className="grid lg:grid-cols-[1fr_120px_auto] gap-3 items-end">
            <Field label="Valor" htmlFor="amount-input" required>
              <MoneyInput
                name="amount-input"
                onValueChange={(v) => setAmount(v)}
                defaultValue={0}
              />
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
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Salvando…" : "Adicionar"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
          Adicionar pagamento dedutível
        </Button>
      )}
    </div>
  );
}
