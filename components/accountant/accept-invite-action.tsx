"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptAccountantInvite } from "@/services/accountant.actions";

export function AcceptInviteAction({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      const r = await acceptAccountantInvite(token);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Acesso ativado!");
        router.push("/contador");
        router.refresh();
      }
    });
  };

  return (
    <Button variant="primary" onClick={handle} disabled={pending}>
      <Check className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
      {pending ? "Ativando…" : "Aceitar e abrir painel"}
    </Button>
  );
}
