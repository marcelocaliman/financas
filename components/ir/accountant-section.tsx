"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Copy, X, Check, Clock, AlertCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createAccountantInvite,
  revokeAccountantInvite,
  revokeAccountantAccess,
  type AccountantFormState,
} from "@/services/accountant.actions";
import type { Tables } from "@/types/database";

type Invite = Tables<"accountant_invites">;
type Access = Tables<"accountant_household_access"> & {
  accountant: {
    full_name: string;
    email: string;
    crc_number: string | null;
    crc_state: string | null;
  } | null;
};
type Audit = Tables<"accountant_audit_log"> & {
  accountant: { full_name: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  view_year: "Abriu o ano",
  view_section: "Visualizou seção",
  export_dec: "Baixou .DEC",
  export_txt: "Baixou TXT",
  login: "Logou",
};

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function AccountantSection({
  year,
  invites,
  accesses,
  audit,
}: {
  year: number;
  invites: Invite[];
  accesses: Access[];
  audit: Audit[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [revokePending, startRevoke] = useTransition();
  const confirm = useConfirm();

  const [state, action, pending] = useActionState<
    AccountantFormState | undefined,
    FormData
  >(createAccountantInvite, undefined);

  useEffect(() => {
    if (state?.ok && state.inviteUrl) {
      setLastInviteUrl(state.inviteUrl);
      setShowForm(false);
      toast.success("Convite gerado. Copie o link e envie ao contador.");
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  const handleRevokeInvite = async (id: string) => {
    const ok = await confirm({
      title: "Cancelar convite?",
      description: "O link gerado não funcionará mais.",
      confirmLabel: "Cancelar convite",
      destructive: true,
    });
    if (!ok) return;
    startRevoke(async () => {
      const r = await revokeAccountantInvite(id);
      if (r.error) toast.error(r.error);
      else toast.success("Convite cancelado.");
    });
  };

  const handleRevokeAccess = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Revogar acesso de ${name}?`,
      description:
        "O contador perde acesso imediato. Pode ser reativado emitindo novo convite.",
      confirmLabel: "Revogar acesso",
      destructive: true,
    });
    if (!ok) return;
    startRevoke(async () => {
      const r = await revokeAccountantAccess({ id, reason: "Revogado pelo titular" });
      if (r.error) toast.error(r.error);
      else toast.success("Acesso revogado.");
    });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  };

  // Default: ano corrente + ano-base atual
  const currentYear = new Date().getUTCFullYear();
  const defaultYears = Array.from(
    new Set([year, currentYear - 1, currentYear].filter((y) => y >= 2020)),
  ).sort((a, b) => b - a);

  // Default expires_at: 60 dias à frente
  const defaultExpires = new Date();
  defaultExpires.setDate(defaultExpires.getDate() + 60);
  const defaultExpiresStr = defaultExpires.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Acessos ativos */}
      {accesses.length > 0 ? (
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2">
            Acessos ativos
          </div>
          <ul className="space-y-2">
            {accesses.map((a) => {
              const days = daysLeft(a.expires_at);
              return (
                <li
                  key={a.id}
                  className="border border-border rounded-[8px] p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-medium text-foreground">
                        {a.accountant?.full_name ?? "—"}
                      </span>
                      <span className="font-mono text-[11px] text-faint-foreground">
                        {a.accountant?.email}
                      </span>
                      {a.accountant?.crc_number ? (
                        <Badge tone="navy">
                          CRC-{a.accountant.crc_state} {a.accountant.crc_number}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" strokeWidth={1.8} />
                        {days} dias restantes (até{" "}
                        {new Date(a.expires_at).toLocaleDateString("pt-BR")})
                      </span>
                      <span>IRPF {a.years_allowed.join(", ")}</span>
                      {a.last_accessed_at ? (
                        <span>
                          Último acesso{" "}
                          {new Date(a.last_accessed_at).toLocaleString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-gold-700">Ainda não acessou</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revokePending}
                    onClick={() =>
                      handleRevokeAccess(a.id, a.accountant?.full_name ?? "contador")
                    }
                    className="text-rust-600"
                  >
                    Revogar
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Convites pendentes */}
      {invites.length > 0 ? (
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2">
            Convites pendentes
          </div>
          <ul className="space-y-2">
            {invites.map((i) => (
              <li
                key={i.id}
                className="border border-border bg-surface-muted/30 rounded-[8px] p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] text-foreground">{i.email}</span>
                    <Badge tone="gold">aguardando aceite</Badge>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">
                    IRPF {i.years_allowed.join(", ")} · expira{" "}
                    {new Date(i.expires_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revokePending}
                  onClick={() => handleRevokeInvite(i.id)}
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Link recém gerado */}
      {lastInviteUrl ? (
        <div className="border border-olive-600/40 bg-olive-600/10 rounded-[8px] p-3 flex items-center gap-3">
          <Check className="w-5 h-5 text-olive-700 shrink-0" strokeWidth={1.8} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-foreground font-medium mb-1">
              Link gerado — copie e envie ao contador
            </div>
            <code className="block text-[11px] font-mono bg-surface px-2 py-1.5 rounded-[5px] border border-border truncate">
              {lastInviteUrl}
            </code>
          </div>
          <Button size="sm" variant="primary" onClick={() => copyUrl(lastInviteUrl)}>
            <Copy className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
            Copiar
          </Button>
        </div>
      ) : null}

      {/* Form novo convite */}
      {showForm ? (
        <form action={action} className="border-t border-border pt-4 space-y-3">
          <div className="grid lg:grid-cols-[1.5fr_1fr_auto] gap-3 items-end">
            <Field label="Email do contador" htmlFor="invite-email" required>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="contador@exemplo.com"
              />
            </Field>
            <Field label="Acesso até" htmlFor="invite-expires" required hint="máximo 60 dias">
              <Input
                id="invite-expires"
                name="expires_at"
                type="date"
                required
                defaultValue={defaultExpiresStr}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Gerando…" : "Gerar link"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2">
              Anos liberados
            </div>
            <div className="flex flex-wrap gap-2">
              {defaultYears.map((y) => (
                <label
                  key={y}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-strong rounded-[6px] cursor-pointer hover:bg-surface-muted text-[12.5px]"
                >
                  <input
                    type="checkbox"
                    name="years_allowed"
                    value={y}
                    defaultChecked={y === year}
                    className="accent-navy-700"
                  />
                  Ano-base {y}
                </label>
              ))}
            </div>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
          Convidar novo contador
        </Button>
      )}

      {/* Audit log */}
      {audit.length > 0 ? (
        <div className="pt-4 border-t border-border">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2 inline-flex items-center gap-1.5">
            <History className="w-3 h-3" strokeWidth={1.8} />
            Audit log — últimas 30 ações
          </div>
          <ul className="space-y-1.5">
            {audit.map((a) => (
              <li
                key={a.id}
                className="text-[12px] flex items-baseline gap-2 py-1.5 border-b border-border last:border-b-0"
              >
                <span className="font-mono text-faint-foreground shrink-0">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </span>
                <span className="text-foreground truncate flex-1">
                  <b>{a.accountant?.full_name ?? "contador"}</b>{" "}
                  {ACTION_LABELS[a.action] ?? a.action}
                  {a.target_year ? ` · ano-base ${a.target_year}` : ""}
                </span>
                {a.ip_address ? (
                  <span className="font-mono text-[10px] text-faint-foreground">
                    {String(a.ip_address)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : accesses.length > 0 ? (
        <p className="text-[12px] text-faint-foreground italic pt-3 border-t border-border">
          Nenhuma ação do contador ainda. O audit log aparece aqui quando ele acessar.
        </p>
      ) : null}
    </div>
  );
}
