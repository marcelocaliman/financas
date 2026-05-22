"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { materializeRecurrenceNow } from "@/services/recurrences.actions";

export function MaterializeNowButton({ ruleId }: { ruleId?: string }) {
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      const r = await materializeRecurrenceNow(ruleId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if ((r.created ?? 0) === 0) {
        toast.success("Nada novo pra materializar agora.");
      } else {
        toast.success(`${r.created} transaç${r.created === 1 ? "ão" : "ões"} criada${r.created === 1 ? "" : "s"}.`);
      }
    });
  };

  return (
    <Button variant="secondary" onClick={handle} disabled={pending}>
      <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} strokeWidth={1.7} />
      {pending ? "Materializando…" : "Materializar até hoje"}
    </Button>
  );
}
