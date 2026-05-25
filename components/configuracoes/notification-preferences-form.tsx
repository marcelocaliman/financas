"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  updateNotificationPreferences,
  type NotificationPrefs,
} from "@/services/notification-preferences.actions";

const ITEMS: Array<{
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}> = [
  {
    key: "darf_due_soon",
    label: "DARF vencendo",
    description:
      "Avisa 3 dias antes de DARF de renda variável vencer (pra você pagar antes da multa de 0,33%/dia).",
  },
  {
    key: "ir_retroactive_gaps",
    label: "Lacunas retroativas IR",
    description:
      "1×/mês: lembra se há lançamentos retroativos pendentes pra IR (Aline jan-mai, Amil, contador…).",
  },
  {
    key: "monthly_recap",
    label: "Resumo mensal",
    description:
      "Dia 1 de cada mês: resumo do mês anterior (receita, despesa, sobra, patrimônio).",
  },
  {
    key: "recurring_upcoming",
    label: "Recorrências chegando",
    description:
      "Avisa 1 dia antes de cada recorrência materializar. Pode ser ruidoso — default OFF.",
  },
];

export function NotificationPreferencesForm({
  initial,
}: {
  initial: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setDirty(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const r = await updateNotificationPreferences(prefs);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Preferências salvas.");
      setDirty(false);
    });
  };

  return (
    <div className="space-y-3">
      {ITEMS.map((item) => (
        <label
          key={item.key}
          className="flex items-start gap-3 px-3 py-2.5 rounded-[8px] border border-border bg-surface cursor-pointer hover:bg-surface-muted/40 transition-colors"
        >
          <input
            type="checkbox"
            checked={prefs[item.key]}
            onChange={() => handleToggle(item.key)}
            className="mt-0.5 accent-navy-700"
          />
          <div className="flex-1">
            <div className="text-[13.5px] font-medium text-foreground">{item.label}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
              {item.description}
            </div>
          </div>
        </label>
      ))}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!dirty || pending}
        >
          {pending ? "Salvando…" : "Salvar preferências"}
        </Button>
      </div>
    </div>
  );
}
