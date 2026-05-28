"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { acknowledgeAlertAdminAction } from "@/app/(app)/admin/system-alerts/actions";

export function SystemAlertRowActions({
  id,
  acknowledged,
}: {
  id: string;
  acknowledged: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (acknowledged) {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] text-olive-700 dark:text-olive-500 font-mono">
        <Check className="w-3.5 h-3.5" strokeWidth={2} />
        ack
      </span>
    );
  }

  const handle = () => {
    startTransition(async () => {
      const r = await acknowledgeAlertAdminAction(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Marcado como acknowledged.");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11.5px] font-mono uppercase tracking-[0.06em] border border-border-strong text-foreground hover:bg-surface-muted disabled:opacity-50"
    >
      {pending ? "..." : "Acknowledge"}
    </button>
  );
}
