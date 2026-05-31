"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, User, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  createShadowFiler,
  updateFiler,
  archiveFiler,
  type FilerFormState,
} from "@/services/ir/filers.actions";
import type { Tables } from "@/types/database";

type Filer = Tables<"ir_filers">;

function fmtCPF(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function FilersManager({ filers }: { filers: Filer[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Filer | null>(null);

  return (
    <div className="space-y-3">
      {filers.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          Nenhum declarante cadastrado. Adicione um pra começar.
        </p>
      ) : null}

      <div className="space-y-2">
        {filers.map((f) => (
          <FilerCard
            key={f.id}
            filer={f}
            onEdit={() => {
              setEditing(f);
              setSheetOpen(true);
            }}
          />
        ))}
      </div>

      <Button
        variant="ghost"
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        className="w-full justify-center border border-dashed border-border hover:bg-bone-100 dark:hover:bg-ink-800"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
        Adicionar cônjuge/declarante
      </Button>

      <FilerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filer={editing}
      />
    </div>
  );
}

function FilerCard({ filer, onEdit }: { filer: Filer; onEdit: () => void }) {
  const isShadow = !filer.user_id;
  const isPrimary = filer.is_primary;

  async function handleArchive() {
    if (!confirm(`Arquivar declarante "${filer.full_name}"?`)) return;
    const res = await archiveFiler(filer.id);
    if (res.error) toast.error(res.error);
    else toast.success("Declarante arquivado.");
  }

  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-border bg-bone-50 dark:bg-ink-900 px-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-navy-100 dark:bg-navy-700/40 flex items-center justify-center">
        {isPrimary ? (
          <UserCog className="w-4 h-4 text-navy-700 dark:text-navy-100" strokeWidth={1.7} />
        ) : (
          <User className="w-4 h-4 text-navy-700 dark:text-navy-100" strokeWidth={1.7} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium text-foreground truncate">
            {filer.full_name}
          </span>
          {isPrimary ? <Badge tone="navy">Titular (login)</Badge> : null}
          {isShadow ? <Badge tone="neutral">Perfil sombra</Badge> : null}
        </div>
        <div className="text-[11.5px] font-mono text-faint-foreground mt-0.5">
          CPF {fmtCPF(filer.cpf)}
          {filer.occupation ? ` · ${filer.occupation}` : ""}
        </div>
      </div>
      <Tooltip content="Editar declarante">
        <button
          type="button"
          onClick={onEdit}
          className="text-faint-foreground hover:text-foreground p-1.5 rounded hover:bg-bone-100 dark:hover:bg-ink-800"
          aria-label="Editar"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
        </button>
      </Tooltip>
      {!isPrimary ? (
        <Tooltip content="Arquivar declarante">
          <button
            type="button"
            onClick={handleArchive}
            className="text-faint-foreground hover:text-rust-600 p-1.5 rounded hover:bg-bone-100 dark:hover:bg-ink-800"
            aria-label="Arquivar"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

function FilerSheet({
  open,
  onOpenChange,
  filer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filer: Filer | null;
}) {
  const isEdit = !!filer;

  const updateAction = filer ? updateFiler.bind(null, filer.id) : null;
  const [state, action, pending] = useActionState<FilerFormState | undefined, FormData>(
    isEdit && updateAction ? updateAction : createShadowFiler,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Declarante atualizado." : "Declarante adicionado.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar declarante" : "Novo declarante"}
          title={isEdit ? "Atualizar dados do declarante." : "Adicionar cônjuge."}
          description={
            isEdit
              ? "Os dados ficam na configuração do IR e aparecem no .DEC quando você gerar."
              : "Perfil sem login próprio. Você gerencia tudo dela aqui no app."
          }
        />

        <form action={action} className="space-y-4">
          <Field label="Nome completo" htmlFor="fullName" required>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={filer?.full_name ?? ""}
              placeholder="Nome completo do declarante"
              autoFocus
            />
            {state?.fieldErrors?.fullName ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.fullName}</p>
            ) : null}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF" htmlFor="cpf" required>
              <Input
                id="cpf"
                name="cpf"
                defaultValue={filer ? fmtCPF(filer.cpf) : ""}
                placeholder="000.000.000-00"
                className="font-mono"
                maxLength={14}
              />
              {state?.fieldErrors?.cpf ? (
                <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.cpf}</p>
              ) : null}
            </Field>
            <Field label="Data de nascimento" htmlFor="birthDate">
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={filer?.birth_date ?? ""}
              />
            </Field>
          </div>

          <Field label="Ocupação" htmlFor="occupation">
            <Input
              id="occupation"
              name="occupation"
              defaultValue={filer?.occupation ?? ""}
              placeholder="Engenheira de software"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Código ocupação Receita" htmlFor="occupationCode" hint="4 dígitos">
              <Input
                id="occupationCode"
                name="occupationCode"
                defaultValue={filer?.occupation_code ?? ""}
                placeholder="0405"
                className="font-mono"
                maxLength={4}
              />
            </Field>
            <Field label="Natureza" htmlFor="natureOfOccupation">
              <Input
                id="natureOfOccupation"
                name="natureOfOccupation"
                defaultValue={filer?.nature_of_occupation ?? ""}
                placeholder="Empregado regime CLT"
              />
            </Field>
          </div>

          <Field label="Título de eleitor" htmlFor="voterId" hint="Opcional (necessário pra DEC)">
            <Input
              id="voterId"
              name="voterId"
              defaultValue={filer?.voter_id ?? ""}
              placeholder="0000 0000 0000"
              className="font-mono"
            />
          </Field>

          {/* Moléstia grave — isenta 100% da aposentadoria/pensão (Lei 7.713/88) */}
          <label className="flex items-start gap-2.5 cursor-pointer rounded-[8px] border border-border px-3 py-2.5 hover:bg-surface-muted">
            <input
              type="checkbox"
              name="hasSeriousIllness"
              defaultChecked={filer?.has_serious_illness ?? false}
              className="mt-0.5 h-4 w-4 accent-navy-700"
            />
            <span className="text-[12.5px] leading-relaxed">
              <span className="font-medium text-foreground">Portador de moléstia grave</span>
              <span className="block text-faint-foreground">
                Isenta 100% dos proventos de aposentadoria/pensão (Lei 7.713/88, art. 6º XIV).
                Auto-declaração — guarde o laudo médico.
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
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
