"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TripSheet } from "./trip-sheet";

export function NewTripButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
        Nova viagem
      </Button>
      <TripSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
