"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Shield, UserMinus, UserPlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  demoteHouseholdMember,
  promoteHouseholdMember,
  removeHouseholdMember,
} from "@/services/platform-admin.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";

type MemberRow = {
  id: string;
  display_name: string;
  role: "admin" | "member";
  is_active: boolean;
  created_at: string;
};

export function MembersManagement({
  members,
  isAdmin,
  currentUserId,
  ownerUserId,
}: {
  members: MemberRow[];
  isAdmin: boolean;
  currentUserId: string;
  ownerUserId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const handlePromote = (m: MemberRow) => {
    startTransition(async () => {
      const r = await promoteHouseholdMember(m.id);
      if (r.error) toast.error(r.error);
      else toast.success(`${m.display_name} promovido a admin.`);
    });
  };

  const handleDemote = async (m: MemberRow) => {
    const ok = await confirm({
      title: `Remover admin de ${m.display_name}?`,
      description: "Vira member comum (mantém acesso, perde poder de gerenciamento).",
      confirmLabel: "Remover admin",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await demoteHouseholdMember(m.id);
      if (r.error) toast.error(r.error);
      else toast.success(`${m.display_name} agora é member.`);
    });
  };

  const handleRemove = async (m: MemberRow) => {
    const ok = await confirm({
      eyebrow: "Ação destrutiva",
      title: `Remover ${m.display_name} do household?`,
      description:
        "Perde todo acesso ao app, mas os dados que ele criou (transações, etc) ficam no household.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await removeHouseholdMember(m.id);
      if (r.error) toast.error(r.error);
      else toast.success(`${m.display_name} removido.`);
    });
  };

  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const isOwner = m.id === ownerUserId;
        const isMe = m.id === currentUserId;
        return (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-b-0"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-medium text-foreground truncate">
                  {m.display_name}
                </span>
                {isOwner ? (
                  <Badge tone="gold">
                    <Crown className="w-3 h-3 inline mr-1" strokeWidth={1.8} />
                    Owner
                  </Badge>
                ) : null}
                {isMe ? <Badge tone="neutral">Vc</Badge> : null}
                <Badge tone={m.role === "admin" ? "navy" : "neutral"}>
                  {m.role === "admin" ? "Admin" : "Member"}
                </Badge>
                {!m.is_active ? <Badge tone="rust">Inativo</Badge> : null}
              </div>
              <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
                Desde {new Date(m.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>

            {isAdmin && !isMe && m.is_active ? (
              <div className="flex items-center gap-1 shrink-0">
                {m.role === "member" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handlePromote(m)}
                  >
                    <Shield className="w-3 h-3" strokeWidth={1.8} />
                    Promover
                  </Button>
                ) : !isOwner ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleDemote(m)}
                  >
                    Tirar admin
                  </Button>
                ) : null}
                {!isOwner ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rust-600/40 text-rust-600 hover:bg-rust-600/10"
                    disabled={pending}
                    onClick={() => handleRemove(m)}
                  >
                    <UserMinus className="w-3 h-3" strokeWidth={1.8} />
                    Remover
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
