"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recomputeDarfs } from "@/services/ir/actions";

export function RecomputeDarfsButton({ year }: { year: number }) {
  const [pending, startTransition] = useTransition();
  const handle = () => {
    startTransition(async () => {
      const r = await recomputeDarfs(year);
      if (r.error) toast.error(r.error);
      else toast.success(`${r.persisted ?? 0} DARFs persistidos.`);
    });
  };
  return (
    <Button size="sm" variant="ghost" onClick={handle} disabled={pending} className="ml-auto">
      <RefreshCw className={"w-3.5 h-3.5 mr-1.5 " + (pending ? "animate-spin" : "")} strokeWidth={1.7} />
      {pending ? "Recalculando…" : "Recalcular DARFs"}
    </Button>
  );
}
