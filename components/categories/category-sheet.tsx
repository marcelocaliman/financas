"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { PillGroup } from "@/components/ui/pill-group";
import {
  createCategory,
  updateCategory,
  type CategoryFormState,
} from "@/services/categories.actions";
import { useIrEnabled } from "@/components/ir/ir-enabled-context";
import type { CategoryKind, Tables } from "@/types/database";

type Category = Tables<"categories">;

export function CategorySheet({
  open,
  onOpenChange,
  category,
  defaultKind = "expense",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category?: Category | null;
  defaultKind?: CategoryKind;
}) {
  const isEdit = !!category;
  const irEnabled = useIrEnabled();
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind);

  const [state, action, pending] = useActionState<CategoryFormState | undefined, FormData>(
    isEdit ? updateCategory : createCategory,
    undefined,
  );

  // Reset on open (React 19 pattern: derive de prop change)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setKind(category?.kind ?? defaultKind);
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Categoria atualizada." : "Categoria criada.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar" : "Nova categoria"}
          title={isEdit ? "Editar categoria." : "Adicionar categoria."}
          description="Categorias agrupam suas transações em algo que faz sentido pro casal."
        />

        <form action={action} className="space-y-5">
          {isEdit ? <input type="hidden" name="id" value={category.id} /> : null}

          <Field label="Tipo">
            <PillGroup
              options={[
                { value: "expense", label: "Despesa" },
                { value: "income", label: "Receita" },
              ]}
              value={kind === "transfer" ? "expense" : kind}
              onChange={(v) => setKind(v as CategoryKind)}
              name="kind"
            />
          </Field>

          <Field label="Nome" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={category?.name ?? ""}
              placeholder="Mercado, salário, delivery…"
              autoFocus
            />
            {state?.fieldErrors?.name ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.name}</p>
            ) : null}
          </Field>

          <Field label="Ícone (lucide)" htmlFor="icon" hint="Opcional. Veja nomes em lucide.dev.">
            <Input
              id="icon"
              name="icon"
              defaultValue={category?.icon ?? ""}
              placeholder="shopping-cart, briefcase, heart-pulse…"
            />
          </Field>

          {/* IR — Dedução automática quando lançar despesa nesta categoria */}
          {irEnabled && kind === "expense" ? (
            <Field
              label="Dedutível no IRPF?"
              htmlFor="irDeductibleKind"
              hint="Quando setado, despesas nesta categoria viram dedução IR automática (você revisa antes)"
            >
              <select
                id="irDeductibleKind"
                name="irDeductibleKind"
                defaultValue={category?.ir_deductible_kind ?? ""}
                className="w-full h-9 px-3 rounded-[6px] border border-border-strong bg-surface text-[13px]"
              >
                <option value="">— não dedutível</option>
                <option value="plano_saude">Plano de saúde</option>
                <option value="hospital">Hospital / exames</option>
                <option value="medico">Médico</option>
                <option value="dentista">Dentista</option>
                <option value="psicologo">Psicólogo</option>
                <option value="outros_saude">Outros saúde</option>
                <option value="educacao_titular">Educação titular</option>
                <option value="educacao_dependente">Educação dependente</option>
                <option value="inss_titular">INSS titular</option>
                <option value="inss_domestico">INSS doméstico</option>
                <option value="pgbl">PGBL</option>
                <option value="previdencia_privada">Previdência privada</option>
                <option value="pensao_alimenticia">Pensão alimentícia</option>
                <option value="doacao_eca">Doação ECA</option>
                <option value="doacao_cultural">Doação cultural</option>
                <option value="outros">Outros dedutíveis</option>
              </select>
            </Field>
          ) : null}

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Criar categoria"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
