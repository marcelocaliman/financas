"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateHouseholdInvite,
  revokeHouseholdInvite,
} from "@/services/household.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { HouseholdInvite } from "@/services/household";

/**
 * Seção de convites na página /configuracoes.
 *
 * Admin pode:
 *  - Gerar novo código (RPC generate_household_invite)
 *  - Copiar código
 *  - Revogar código
 *
 * Membros normais veem apenas a lista (sem ações).
 */
export function HouseholdInvitesSection({
  invites,
  isAdmin,
}: {
  invites: HouseholdInvite[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const confirm = useConfirm();

  const handleGenerate = () => {
    startTransition(async () => {
      const r = await generateHouseholdInvite();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Código gerado: ${r.data.code}`);
      await copy(r.data.code);
    });
  };

  const handleRevoke = async (code: string) => {
    const ok = await confirm({
      title: `Revogar o código "${code}"?`,
      description: "Quem tiver esse código não poderá mais usar pra ingressar no lar.",
      confirmLabel: "Revogar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await revokeHouseholdInvite(code);
      if (!r.ok) toast.error(r.error);
      else toast.success("Código revogado.");
    });
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setJustCopied(code);
      setTimeout(() => setJustCopied(null), 2000);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar — anote o código manualmente.");
    }
  };

  if (!isAdmin && invites.length === 0) {
    return (
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        Apenas o(a) admin do lar pode criar convites. Peça um código pra quem
        criou esse lar.
      </p>
    );
  }

  return (
    <div>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-3">
        Gera um código de 8 caracteres que sua parceira(o) usa no cadastro pra
        ingressar nesse lar. Cada código vale por 14 dias e pra um único uso.
      </p>

      {isAdmin ? (
        <div className="mb-4">
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={pending}
          >
            Gerar novo código
          </Button>
        </div>
      ) : null}

      {invites.length === 0 ? (
        <p className="text-[12.5px] text-faint-foreground italic">
          Nenhum código ativo.
        </p>
      ) : (
        <ul className="space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] bg-surface-muted border border-border"
            >
              <div className="min-w-0 flex items-center gap-3">
                <code className="font-mono text-[14px] font-medium text-foreground tracking-[0.06em]">
                  {inv.code}
                </code>
                <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em]">
                  expira {formatRelative(inv.expires_at)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copy(inv.code)}
                  disabled={pending}
                  aria-label="Copiar código"
                >
                  {justCopied === inv.code ? (
                    <Check className="w-3.5 h-3.5 text-olive-700" strokeWidth={1.7} />
                  ) : (
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.7} />
                  )}
                </Button>
                {isAdmin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevoke(inv.code)}
                    disabled={pending}
                    className="text-rust-600"
                    aria-label="Revogar"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.7} />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}
