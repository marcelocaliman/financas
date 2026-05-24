"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { upsertFlag } from "@/services/feature-flags.actions";

export function NewFeatureFlagForm() {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const r = await upsertFlag(formData);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Flag criada.");
        setExpanded(false);
      }
    });
  };

  if (!expanded) {
    return (
      <Button variant="outline" onClick={() => setExpanded(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
        Nova feature flag
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
        Nova feature flag
      </div>
      <Field
        label="Chave (key)"
        htmlFor="key"
        required
        hint="snake_case, sem espaços. Ex: investments_ai_insights"
      >
        <Input
          id="key"
          name="key"
          placeholder="minha_feature"
          required
          pattern="[a-z0-9_]+"
        />
      </Field>
      <Field label="Descrição" htmlFor="description" hint="O que essa feature faz">
        <Textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Liga o painel novo de IA na página X…"
        />
      </Field>
      <div className="flex items-center gap-2">
        <input type="checkbox" name="enabled" id="enabled" className="w-4 h-4 accent-navy-700" />
        <label htmlFor="enabled" className="text-[13px] text-foreground">
          Ligar imediatamente após criar
        </label>
      </div>
      <input type="hidden" name="rolloutPct" value="100" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Criando…" : "Criar flag"}
        </Button>
      </div>
    </form>
  );
}
