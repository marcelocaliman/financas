"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createDependent, deleteDependent, type IRFormState } from "@/services/ir/actions";
import { formatDateNumeric } from "@/lib/utils/format";
import type { Tables } from "@/types/database";

const RELATIONSHIPS: { value: string; label: string }[] = [
  { value: "conjuge", label: "Cônjuge" },
  { value: "companheiro", label: "Companheiro(a)" },
  { value: "filho", label: "Filho" },
  { value: "filha", label: "Filha" },
  { value: "enteado", label: "Enteado(a)" },
  { value: "pais", label: "Pai/Mãe" },
  { value: "avos", label: "Avô/Avó" },
  { value: "irmaos", label: "Irmão/Irmã" },
  { value: "menor_guarda", label: "Menor sob guarda" },
  { value: "outros", label: "Outros" },
];

export function DependentsManager({
  dependents,
  filers = [],
}: {
  dependents: Tables<"ir_dependents">[];
  filers?: Tables<"ir_filers">[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, action, pending] = useActionState<IRFormState | undefined, FormData>(
    createDependent,
    undefined,
  );
  const [delPending, startDelete] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Dependente adicionado.");
      setShowForm(false);
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Remover ${name}?`,
      description: "Não vai apagar o histórico — só some da declaração.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    startDelete(async () => {
      const r = await deleteDependent(id);
      if (r.error) toast.error(r.error);
      else toast.success("Removido.");
    });
  };

  return (
    <div>
      {dependents.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic mb-4">
          Sem dependentes. Cada dependente gera dedução de R$ 2.275,08/ano no modelo Completo.
        </p>
      ) : (
        <table className="w-full text-[12.5px] mb-4">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th className="text-left pb-2 font-medium">Nome</th>
              <th className="text-left pb-2 font-medium">CPF</th>
              <th className="text-left pb-2 font-medium">Relação</th>
              <th className="text-left pb-2 font-medium">Nascimento</th>
              <th className="text-right pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {dependents.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="py-2 text-foreground">{d.name}</td>
                <td className="py-2 font-mono text-faint-foreground">{d.cpf ?? "—"}</td>
                <td className="py-2 text-muted-foreground capitalize">{d.relationship.replace("_", " ")}</td>
                <td className="py-2 font-mono text-faint-foreground">
                  {d.birth_date ? formatDateNumeric(d.birth_date) : "—"}
                </td>
                <td className="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(d.id, d.name)}
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
        <form action={action} className="grid lg:grid-cols-5 gap-3 items-end border-t border-border pt-4">
          <Field label="Nome" htmlFor="name" required>
            <Input id="name" name="name" required />
          </Field>
          <Field label="CPF" htmlFor="cpf">
            <Input id="cpf" name="cpf" placeholder="000.000.000-00" />
          </Field>
          <Field label="Relação" htmlFor="relationship" required>
            <Select name="relationship" defaultValue="filho">
              <SelectTrigger id="relationship"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nascimento" htmlFor="birth_date">
            <Input id="birth_date" name="birth_date" type="date" />
          </Field>
          {filers.length >= 2 ? (
            <Field label="Entra na declaração de" htmlFor="ownerFilerId" required>
              <Select name="ownerFilerId" defaultValue={filers[0]?.id}>
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
          Adicionar dependente
        </Button>
      )}
    </div>
  );
}
