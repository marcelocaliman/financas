"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Shield, UserMinus, UserPlus, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deactivateUser,
  deleteUser,
  promoteToPlatformAdmin,
  reactivateUser,
  revokePlatformAdmin,
} from "@/services/platform-admin.actions";
import type { UserAdminRow } from "@/services/platform-admin";

export function UserAdminActions({ user }: { user: UserAdminRow }) {
  const [pending, startTransition] = useTransition();
  const [adminNotes, setAdminNotes] = useState("");
  const [deactivateReason, setDeactivateReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const togglePlatformAdmin = () => {
    startTransition(async () => {
      const r = user.is_platform_admin
        ? await revokePlatformAdmin(user.id)
        : await promoteToPlatformAdmin(user.id, adminNotes || undefined);
      if (r.error) toast.error(r.error);
      else toast.success(user.is_platform_admin ? "Revogado." : "Promovido a superadmin.");
    });
  };

  const handleDeactivate = () => {
    if (!deactivateReason.trim()) {
      toast.error("Informe um motivo.");
      return;
    }
    startTransition(async () => {
      const r = await deactivateUser(user.id, deactivateReason);
      if (r.error) toast.error(r.error);
      else toast.success("Usuário desativado.");
    });
  };

  const handleReactivate = () => {
    startTransition(async () => {
      const r = await reactivateUser(user.id);
      if (r.error) toast.error(r.error);
      else toast.success("Usuário reativado.");
    });
  };

  const handleDelete = () => {
    if (confirmEmail !== user.email) {
      toast.error("Email não confere.");
      return;
    }
    if (!confirm(`HARD DELETE de ${user.email}. Sem volta. Confirma?`)) return;
    startTransition(async () => {
      const r = await deleteUser(user.id, confirmEmail);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Usuário excluído.");
        window.location.href = "/admin/users";
      }
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Superadmin */}
      <Panel className={user.is_platform_admin ? "border-gold-600/30" : ""}>
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3 inline-flex items-center gap-2">
          <Shield className="w-4 h-4 text-gold-600" strokeWidth={1.7} />
          Superadmin (platform)
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3">
          {user.is_platform_admin
            ? "Este usuário tem acesso ao painel /admin e a todos os dados via service-role."
            : "Promover dá acesso global. Use com critério — toda ação fica no audit log."}
        </p>
        {!user.is_platform_admin ? (
          <Field label="Notas (opcional)" htmlFor="adminNotes">
            <Input
              id="adminNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Por que está promovendo?"
            />
          </Field>
        ) : null}
        <div className="mt-3">
          <Button
            variant={user.is_platform_admin ? "outline" : "primary"}
            disabled={pending}
            onClick={togglePlatformAdmin}
            className={
              user.is_platform_admin
                ? "border-rust-600/40 text-rust-600 hover:bg-rust-600/10"
                : ""
            }
          >
            {user.is_platform_admin ? (
              <>
                <UserMinus className="w-3.5 h-3.5" strokeWidth={1.8} />
                Revogar superadmin
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" strokeWidth={1.8} />
                Promover a superadmin
              </>
            )}
          </Button>
        </div>
      </Panel>

      {/* Deactivate / Reactivate */}
      <Panel>
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
          Status do usuário
        </div>
        {user.is_active ? (
          <div className="space-y-3">
            <Field label="Motivo da desativação" htmlFor="deactivateReason">
              <Textarea
                id="deactivateReason"
                rows={2}
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Inatividade, suspeita de abuso, pedido do próprio user…"
              />
            </Field>
            <Button
              variant="outline"
              className="border-gold-600/40 text-gold-700 dark:text-gold-500 hover:bg-gold-600/10"
              disabled={pending}
              onClick={handleDeactivate}
            >
              Desativar usuário
            </Button>
            <p className="text-[11px] text-faint-foreground leading-relaxed">
              Soft-delete: mantém auditoria. Diferente de "Apagar". Pode ser
              revertido a qualquer momento.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] text-muted-foreground mb-3">
              Usuário desativado desde{" "}
              {user.deactivated_at
                ? new Date(user.deactivated_at).toLocaleString("pt-BR")
                : "—"}
              .
            </p>
            <Button variant="primary" disabled={pending} onClick={handleReactivate}>
              Reativar usuário
            </Button>
          </>
        )}
      </Panel>

      {/* Hard delete (LGPD) */}
      <Panel className="lg:col-span-2 border-rust-600/30">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-rust-600 mb-1 inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" strokeWidth={1.7} />
          Exclusão permanente · LGPD art. 18 VI
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3 leading-relaxed">
          Apaga a conta auth + perfil + tudo via cascade. Direito do titular de
          dados. Recomenda-se exportar os dados antes (LGPD art. 18 V).
        </p>
        <div className="flex items-end gap-2">
          <Field
            label={`Digite "${user.email ?? "<sem email>"}" pra confirmar`}
            htmlFor="confirmEmail"
            className="flex-1"
          >
            <Input
              id="confirmEmail"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email ?? ""}
            />
          </Field>
          <Button
            variant="danger"
            disabled={pending || !user.email || confirmEmail !== user.email}
            onClick={handleDelete}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
            Apagar conta
          </Button>
        </div>
      </Panel>
    </div>
  );
}
