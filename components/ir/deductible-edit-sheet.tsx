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
import { updateDeductiblePayment, type IRFormState } from "@/services/ir/actions";
import { HealthPlanScenarioHelper } from "@/components/ir/health-plan-scenario-helper";
import type { IRDeductibleKind, Tables } from "@/types/database";

const KINDS: { value: IRDeductibleKind; label: string }[] = [
  { value: "plano_saude", label: "Plano de saúde" },
  { value: "hospital", label: "Hospital / exames" },
  { value: "medico", label: "Médico" },
  { value: "dentista", label: "Dentista" },
  { value: "psicologo", label: "Psicólogo" },
  { value: "outros_saude", label: "Outros profissionais saúde" },
  { value: "educacao_titular", label: "Educação titular" },
  { value: "educacao_dependente", label: "Educação dependente" },
  { value: "inss_titular", label: "INSS titular" },
  { value: "inss_domestico", label: "INSS empregado doméstico" },
  { value: "pgbl", label: "PGBL" },
  { value: "previdencia_privada", label: "Previdência privada" },
  { value: "pensao_alimenticia", label: "Pensão alimentícia" },
  { value: "honorarios_advocaticios_pensao", label: "Honorários advogado (obter pensão)" },
  { value: "doacao_eca", label: "Doação ECA" },
  { value: "doacao_cultural", label: "Doação Lei Rouanet" },
  { value: "outros", label: "Outros" },
];

function fmtCNPJorCPF(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 11) {
    // CPF format
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }
  // CNPJ format
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function DeductibleEditSheet({
  open,
  onOpenChange,
  payment,
  filers = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payment: Tables<"ir_deductible_payments">;
  filers?: Tables<"ir_filers">[];
}) {
  const updateAction = updateDeductiblePayment.bind(null, payment.id);
  const [state, action, pending] = useActionState<IRFormState | undefined, FormData>(
    updateAction,
    undefined,
  );

  const [amount, setAmount] = useState(Number(payment.amount));
  const [cnpjCpf, setCnpjCpf] = useState(payment.recipient_cnpj_cpf ?? "");
  const [isDependentPayment, setIsDependentPayment] = useState(
    payment.is_dependent_payment ?? false,
  );
  const [kind, setKind] = useState<IRDeductibleKind>(payment.kind);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAmount(Number(payment.amount));
      setCnpjCpf(payment.recipient_cnpj_cpf ?? "");
      setIsDependentPayment(payment.is_dependent_payment ?? false);
      setKind(payment.kind);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success("Pagamento atualizado.");
      onOpenChange(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={`IRPF · ${payment.year}`}
          title="Editar pagamento dedutível."
          description="Preencha CNPJ/CPF do beneficiário pra a Receita aceitar a dedução em caso de malha."
        />

        <form action={action} className="space-y-4">
          <input type="hidden" name="year" value={payment.year} />
          <input type="hidden" name="amount" value={amount} />

          <Field label="Tipo" htmlFor="kind" required>
            <Select name="kind" value={kind} onValueChange={(v) => setKind(v as IRDeductibleKind)}>
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {kind === "plano_saude" ? (
            <HealthPlanScenarioHelper defaultOpen={!payment.recipient_cnpj_cpf} />
          ) : null}

          <Field label="Descrição" htmlFor="description" required>
            <Input
              id="description"
              name="description"
              defaultValue={payment.description}
              placeholder="Mensalidade Amil"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Pago a (nome)" htmlFor="recipient_name" required>
              <Input
                id="recipient_name"
                name="recipient_name"
                defaultValue={payment.recipient_name}
                placeholder="Amil Assistência Médica"
              />
            </Field>
            <Field
              label="CNPJ/CPF do beneficiário"
              htmlFor="recipient_cnpj_cpf"
              required
              hint="Obrigatório pela Receita"
            >
              <Input
                id="recipient_cnpj_cpf"
                name="recipient_cnpj_cpf"
                value={fmtCNPJorCPF(cnpjCpf)}
                onChange={(e) => setCnpjCpf(e.target.value.replace(/\D/g, "").slice(0, 14))}
                placeholder="00.000.000/0000-00"
                className="font-mono"
                maxLength={18}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <Field label="Beneficiário do gasto" htmlFor="beneficiary" hint="Nome do dependente atendido (se aplicável)">
              <Input
                id="beneficiary"
                name="beneficiary"
                defaultValue={payment.beneficiary ?? ""}
                placeholder="Esposa, filho, etc"
              />
            </Field>
            <Field label="Data" htmlFor="payment_date">
              <Input
                id="payment_date"
                name="payment_date"
                type="date"
                defaultValue={payment.payment_date ?? ""}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor" htmlFor="amount-input" required>
              <MoneyInput
                name="amount-input"
                defaultValue={amount}
                onValueChange={setAmount}
              />
            </Field>
            <Field label="Moeda" htmlFor="currency">
              <Select name="currency" defaultValue={payment.currency}>
                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ BRL</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="USD">US$ USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {filers.length >= 2 ? (
            <Field label="Pago por (declaração)" htmlFor="ownerFilerId" required>
              <Select name="ownerFilerId" defaultValue={payment.owner_filer_id ?? filers[0]?.id}>
                <SelectTrigger id="ownerFilerId"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filers.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : filers[0] ? (
            <input type="hidden" name="ownerFilerId" value={filers[0].id} />
          ) : null}

          <label className="flex items-start gap-2.5 cursor-pointer rounded-[8px] bg-surface-muted/50 px-3 py-2.5">
            <input
              type="checkbox"
              name="is_dependent_payment"
              value="true"
              checked={isDependentPayment}
              onChange={(e) => setIsDependentPayment(e.target.checked)}
              className="mt-0.5 accent-navy-700"
            />
            <span className="text-[12.5px]">
              <b className="text-foreground">Pagamento de dependente</b>
              <br />
              <span className="text-muted-foreground">
                Marque se a despesa é de cônjuge ou outro dependente seu (e não de você mesmo).
              </span>
            </span>
          </label>

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <Textarea
            name="notes"
            placeholder="Notas (opcional)"
            rows={2}
            defaultValue={payment.notes ?? ""}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
