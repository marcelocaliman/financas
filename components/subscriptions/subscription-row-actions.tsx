"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSubscriptionTag } from "@/services/subscriptions.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * Botão "desmarcar como assinatura" — remove a tag mas mantém a regra
 * recorrente intacta (continua materializando, só não aparece aqui).
 */
export function SubscriptionRowActions({
  ruleId,
  description,
}: {
  ruleId: string;
  description: string;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const handleUnflag = async () => {
    const ok = await confirm({
      title: `Desmarcar "${description}" como assinatura?`,
      description:
        "A regra recorrente continua ativa (Netflix continua sendo cobrada). Só some dessa página.",
      confirmLabel: "Desmarcar",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await toggleSubscriptionTag(ruleId, false);
      if (r.error) toast.error(r.error);
      else toast.success("Desmarcada.");
    });
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleUnflag}
      disabled={pending}
      aria-label="Desmarcar como assinatura"
      className="opacity-0 group-hover:opacity-100 text-faint-foreground hover:text-rust-600"
    >
      <X className="w-3.5 h-3.5" strokeWidth={1.7} />
    </Button>
  );
}
