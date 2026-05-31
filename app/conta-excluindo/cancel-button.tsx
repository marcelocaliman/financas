"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelAccountDeletion } from "@/services/lgpd-deletion.actions";

export function CancelDeletionButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const r = await cancelAccountDeletion();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Exclusão cancelada — bem-vindo de volta.");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <button
      onClick={cancel}
      disabled={pending}
      className="inline-flex items-center rounded-[8px] bg-navy-700 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-navy-800 disabled:opacity-50"
    >
      {pending ? "Cancelando…" : "Manter minha conta (cancelar exclusão)"}
    </button>
  );
}
