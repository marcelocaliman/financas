"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Building2, Briefcase, Home, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import {
  createFontePagadora,
  updateFontePagadora,
  deleteFontePagadora,
  type FonteFormState,
} from "@/services/fontes-pagadoras.actions";
import type { Tables, FontePagadoraType, RegimeTributario } from "@/types/database";

const TYPE_LABELS: Record<FontePagadoraType, string> = {
  clt: "Emprego CLT",
  pj_propria: "Minha PJ (MEI/SLU/EI)",
  pj_outros: "Cliente PJ (autônomo)",
  aluguel: "Aluguel recebido",
  pensao: "Pensão recebida",
  aposentadoria: "Aposentadoria/INSS",
  bolsa: "Bolsa de estudos",
  outra: "Outra",
};

const TYPE_ICONS: Record<FontePagadoraType, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  clt: Briefcase,
  pj_propria: Building2,
  pj_outros: Briefcase,
  aluguel: Home,
  pensao: Coins,
  aposentadoria: Coins,
  bolsa: Coins,
  outra: Coins,
};

type Fonte = Tables<"fontes_pagadoras">;

export function FontesPagadorasManager({ fontes }: { fontes: Fonte[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Fonte | null>(null);
  const [delPending, startDelete] = useTransition();
  const confirm = useConfirm();

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Remover ${name}?`,
      description: "Transações já vinculadas a essa fonte perdem o vínculo mas não são apagadas.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    startDelete(async () => {
      const r = await deleteFontePagadora(id);
      if (r.error) toast.error(r.error);
      else toast.success("Removido.");
    });
  };

  const handleEditClick = (f: Fonte) => {
    setEditing(f);
    setShowForm(true);
  };

  const handleAddClick = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="rounded-[8px] border border-gold-200 dark:border-gold-900/40 bg-gold-50/30 dark:bg-gold-950/10 px-3 py-2.5 mb-4 text-[12px] leading-relaxed">
        <b className="text-foreground">Atenção:</b> fontes pagadoras são <b>empresas
        ou pessoas que pagam VOCÊ</b> (empregador CLT, sua PJ, locatário do imóvel,
        INSS quando recebe aposentadoria). Médicos, planos de saúde, hospitais e
        outros prestadores que você paga <b>não</b> entram aqui — esses moram em{" "}
        <Link href="/ir" className="text-navy-700 dark:text-navy-300 underline">
          Pagamentos Dedutíveis
        </Link>{" "}
        dentro de cada ano-base.
      </div>

      {fontes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic mb-4">
          Nenhuma fonte pagadora cadastrada. Quando cadastrar (empresa CLT, sua PJ,
          locatário do imóvel), o app classifica automaticamente cada rendimento recebido
          nas seções corretas do IRPF.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {fontes.map((f) => {
            const Icon = TYPE_ICONS[f.type];
            return (
              <li
                key={f.id}
                className="border border-border rounded-[8px] p-3 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-[7px] bg-navy-700/10 grid place-items-center shrink-0">
                  <Icon className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-medium text-foreground">{f.name}</span>
                    <Badge tone="navy">{TYPE_LABELS[f.type]}</Badge>
                    {f.regime_tributario ? (
                      <Badge tone="gold">{f.regime_tributario.replace("_", " ")}</Badge>
                    ) : null}
                  </div>
                  <div className="text-[11.5px] text-faint-foreground mt-0.5 font-mono">
                    {f.cnpj ? `CNPJ ${f.cnpj}` : f.cpf ? `CPF ${f.cpf}` : "—"}
                    {f.default_irrf_rate ? ` · IRRF default ${f.default_irrf_rate}%` : ""}
                    {f.default_inss_rate ? ` · INSS default ${f.default_inss_rate}%` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Tooltip content="Editar fonte pagadora">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(f)}
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Remover fonte pagadora">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(f.id, f.name)}
                      disabled={delPending}
                      aria-label="Remover"
                      className="text-rust-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <FonteForm
          key={editing?.id ?? "new"}
          editing={editing}
          onDone={handleCancel}
        />
      ) : (
        <Button size="sm" variant="ghost" onClick={handleAddClick}>
          <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
          Adicionar fonte pagadora
        </Button>
      )}
    </div>
  );
}

function FonteForm({
  editing,
  onDone,
}: {
  editing: Fonte | null;
  onDone: () => void;
}) {
  const [type, setType] = useState<FontePagadoraType>(editing?.type ?? "clt");
  const isEdit = !!editing;

  const [state, action, pending] = useActionState<FonteFormState | undefined, FormData>(
    isEdit ? updateFontePagadora : createFontePagadora,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Fonte atualizada." : "Fonte cadastrada.");
      onDone();
    }
    if (state?.error) toast.error(state.error);
  }, [state, isEdit, onDone]);

  const isPjPropria = type === "pj_propria";

  return (
    <form action={action} className="border-t border-border pt-4 space-y-3">
      {isEdit ? <input type="hidden" name="id" value={editing!.id} /> : null}
      <div className="grid lg:grid-cols-2 gap-3">
        <Field label="Tipo" htmlFor="type" required>
          <Select
            name="type"
            value={type}
            onValueChange={(v) => setType(v as FontePagadoraType)}
          >
            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as FontePagadoraType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nome" htmlFor="name" required>
          <Input
            id="name"
            name="name"
            required
            defaultValue={editing?.name ?? ""}
            placeholder="Empresa Acme Ltda"
          />
        </Field>
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Field label="CNPJ" htmlFor="cnpj">
          <Input id="cnpj" name="cnpj" defaultValue={editing?.cnpj ?? ""} placeholder="00.000.000/0001-00" className="font-mono" />
        </Field>
        <Field label="CPF (se PF)" htmlFor="cpf">
          <Input id="cpf" name="cpf" defaultValue={editing?.cpf ?? ""} placeholder="000.000.000-00" className="font-mono" />
        </Field>
      </div>
      {isPjPropria ? (
        <Field label="Regime tributário" htmlFor="regime_tributario">
          <Select name="regime_tributario" defaultValue={(editing?.regime_tributario as RegimeTributario | null) ?? "mei"}>
            <SelectTrigger id="regime_tributario"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mei">MEI</SelectItem>
              <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
              <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
              <SelectItem value="lucro_real">Lucro Real</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <div className="grid lg:grid-cols-2 gap-3">
        <Field label="IRRF default (%)" htmlFor="default_irrf_rate" hint="opcional — se a fonte sempre retém uma % fixa">
          <Input
            id="default_irrf_rate"
            name="default_irrf_rate"
            type="number"
            step="any"
            min="0"
            defaultValue={editing?.default_irrf_rate ?? ""}
          />
        </Field>
        <Field label="INSS default (%)" htmlFor="default_inss_rate">
          <Input
            id="default_inss_rate"
            name="default_inss_rate"
            type="number"
            step="any"
            min="0"
            defaultValue={editing?.default_inss_rate ?? ""}
          />
        </Field>
      </div>
      <Field label="Observações" htmlFor="notes">
        <Input id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
