"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TripSheet } from "./trip-sheet";
import { deleteTrip } from "@/services/trips.actions";
import type { Trip } from "@/types/trips";

export function TripHeaderActions({ trip }: { trip: Trip }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Apagar a viagem "${trip.name}"?`,
      description:
        "As transações vinculadas perdem o vínculo mas continuam existindo. Fotos e orçamento são apagados.",
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteTrip(trip.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Viagem apagada.");
        router.push("/viagens");
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setEditing(true)} disabled={pending}>
        <Pencil className="w-3.5 h-3.5" strokeWidth={1.8} />
        Editar
      </Button>
      <Button variant="ghost" onClick={handleDelete} disabled={pending}>
        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
        Apagar
      </Button>
      <TripSheet open={editing} onOpenChange={setEditing} trip={trip} />
    </div>
  );
}
