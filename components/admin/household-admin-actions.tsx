"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteHousehold,
  suspendHousehold,
  unsuspendHousehold,
  updateSubscription,
} from "@/services/platform-admin.actions";
import type { Tables } from "@/types/database";

export function HouseholdAdminActions({
  household,
}: {
  household: Tables<"households">;
}) {
  const [pending, startTransition] = useTransition();

  // Subscription edit state
  const [tier, setTier] = useState(household.subscription_tier);
  const [status, setStatus] = useState(household.subscription_status);

  // Suspend state
  const [suspendReason, setSuspendReason] = useState("");

  // Delete state
  const [confirmName, setConfirmName] = useState("");

  const handleUpdateSub = () => {
    startTransition(async () => {
      const r = await updateSubscription(household.id, { tier, status });
      if (r.error) toast.error(r.error);
      else toast.success("Assinatura atualizada.");
    });
  };

  const handleSuspend = () => {
    if (!suspendReason.trim()) {
      toast.error("Informe um motivo da suspensão.");
      return;
    }
    startTransition(async () => {
      const r = await suspendHousehold(household.id, suspendReason);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Household suspenso.");
        setSuspendReason("");
      }
    });
  };

  const handleUnsuspend = () => {
    startTransition(async () => {
      const r = await unsuspendHousehold(household.id);
      if (r.error) toast.error(r.error);
      else toast.success("Household reativado.");
    });
  };

  const handleDelete = () => {
    if (confirmName !== household.name) {
      toast.error("Nome de confirmação não confere.");
      return;
    }
    if (!confirm(`HARD DELETE de "${household.name}". Tem certeza ABSOLUTA?`)) {
      return;
    }
    startTransition(async () => {
      const r = await deleteHousehold(household.id, confirmName);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Household excluído.");
        window.location.href = "/admin/households";
      }
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Edição de plano + status */}
      <Panel>
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
          Alterar plano · status
        </div>
        <div className="space-y-3">
          <Field label="Plano" htmlFor="tier">
            <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
              <SelectTrigger id="tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="past_due">Vencido</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button variant="primary" disabled={pending} onClick={handleUpdateSub}>
            Salvar alterações
          </Button>
        </div>
      </Panel>

      {/* Suspend / Unsuspend */}
      <Panel className="border-gold-600/30">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3 inline-flex items-center gap-2">
          <Ban className="w-4 h-4 text-gold-600" strokeWidth={1.7} />
          Suspensão
        </div>
        {household.subscription_status === "suspended" ? (
          <>
            <p className="text-[12.5px] text-muted-foreground mb-3">
              Household atualmente suspenso. Reative pra restaurar acesso.
            </p>
            <Button variant="primary" disabled={pending} onClick={handleUnsuspend}>
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              Reativar household
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <Field
              label="Motivo da suspensão"
              htmlFor="reason"
              hint="Visível no audit log e talvez no email pro usuário (futuro)"
            >
              <Textarea
                id="reason"
                rows={2}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Inadimplência, violação dos termos, requisição legal…"
              />
            </Field>
            <Button
              variant="outline"
              className="border-gold-600/40 text-gold-700 dark:text-gold-500 hover:bg-gold-600/10"
              disabled={pending}
              onClick={handleSuspend}
            >
              <Ban className="w-3.5 h-3.5" strokeWidth={1.8} />
              Suspender
            </Button>
          </div>
        )}
      </Panel>

      {/* Delete (zona vermelha) */}
      <Panel className="lg:col-span-2 border-rust-600/30">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-rust-600 mb-1 inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" strokeWidth={1.7} />
          Zona vermelha · exclusão permanente
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3 leading-relaxed">
          Apaga o household e TODOS os dados associados (transações, metas,
          investimentos, membros). Operação irreversível. Recomenda-se exportar
          os dados antes (LGPD art. 18 V) e notificar os usuários.
        </p>
        <div className="flex items-end gap-2">
          <Field
            label={`Digite "${household.name}" pra confirmar`}
            htmlFor="confirmName"
            className="flex-1"
          >
            <Input
              id="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={household.name}
            />
          </Field>
          <Button
            variant="danger"
            disabled={pending || confirmName !== household.name}
            onClick={handleDelete}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
            Apagar definitivo
          </Button>
        </div>
      </Panel>
    </div>
  );
}
