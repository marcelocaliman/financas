"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategorySheet } from "@/components/categories/category-sheet";

export function NewCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Nova categoria
      </Button>
      <CategorySheet open={open} onOpenChange={setOpen} />
    </>
  );
}
