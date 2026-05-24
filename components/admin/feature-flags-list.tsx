"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  deleteFlag,
  toggleFlag,
  updateFlagDetails,
} from "@/services/feature-flags.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { FeatureFlag } from "@/services/feature-flags";

export function FeatureFlagsList({ flags }: { flags: FeatureFlag[] }) {
  if (flags.length === 0) {
    return (
      <Panel className="!py-12 text-center">
        <div className="text-[13px] text-muted-foreground">
          Nenhuma feature flag cadastrada. Use o form abaixo pra criar.
        </div>
      </Panel>
    );
  }
  return (
    <div className="space-y-3">
      {flags.map((f) => (
        <FlagRow key={f.key} flag={f} />
      ))}
    </div>
  );
}

function FlagRow({ flag }: { flag: FeatureFlag }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rolloutPct, setRolloutPct] = useState(flag.rollout_pct);
  const [tiers, setTiers] = useState<string[]>(flag.enabled_for_tiers ?? []);
  const [description, setDescription] = useState(flag.description ?? "");
  const confirm = useConfirm();

  const handleToggle = () => {
    startTransition(async () => {
      const r = await toggleFlag(flag.key, !flag.enabled);
      if (r.error) toast.error(r.error);
      else toast.success(flag.enabled ? "Desligada." : "Ligada.");
    });
  };

  const handleSaveDetails = () => {
    startTransition(async () => {
      const r = await updateFlagDetails(flag.key, {
        rolloutPct,
        enabledForTiers: tiers as ("free" | "pro" | "family" | "lifetime")[],
        description,
      });
      if (r.error) toast.error(r.error);
      else toast.success("Atualizada.");
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Apagar flag "${flag.key}"?`,
      description: "O código que checa essa flag vai sempre receber false.",
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteFlag(flag.key);
      if (r.error) toast.error(r.error);
      else toast.success("Apagada.");
    });
  };

  const toggleTier = (tier: string) => {
    setTiers((t) => (t.includes(tier) ? t.filter((x) => x !== tier) : [...t, tier]));
  };

  return (
    <Panel className="!p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[13.5px] font-medium text-foreground">
              {flag.key}
            </span>
            <Badge tone={flag.enabled ? "olive" : "neutral"}>
              {flag.enabled ? "ON" : "OFF"}
            </Badge>
            {flag.rollout_pct < 100 ? (
              <Badge tone="navy">{flag.rollout_pct}% rollout</Badge>
            ) : null}
            {flag.enabled_for_tiers.length > 0 ? (
              <Badge tone="gold">
                tiers: {flag.enabled_for_tiers.join(", ")}
              </Badge>
            ) : null}
          </div>
          {flag.description ? (
            <p className="text-[12.5px] text-muted-foreground mt-1.5">
              {flag.description}
            </p>
          ) : null}
          <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-1">
            Atualizada {new Date(flag.updated_at).toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Toggle enabled={flag.enabled} onClick={handleToggle} disabled={pending} />
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-[6px] hover:bg-surface-muted"
            aria-label="Expandir"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              strokeWidth={1.8}
            />
          </button>
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            onClick={handleDelete}
            className="text-rust-600"
            aria-label="Apagar"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          <Field label="Descrição" htmlFor={`d-${flag.key}`}>
            <Input
              id={`d-${flag.key}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que essa feature faz?"
            />
          </Field>
          <Field
            label={`Rollout: ${rolloutPct}%`}
            htmlFor={`r-${flag.key}`}
            hint="Hash determinístico do household_id mapeia pra [0,100). Útil pra liberar gradualmente."
          >
            <input
              id={`r-${flag.key}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={rolloutPct}
              onChange={(e) => setRolloutPct(Number(e.target.value))}
              className="w-full accent-navy-700"
            />
          </Field>
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2">
              Restringir a tiers (vazio = todos)
            </div>
            <div className="flex flex-wrap gap-2">
              {(["free", "pro", "family", "lifetime"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTier(t)}
                  className={
                    "px-2.5 py-1 rounded-[6px] text-[12px] border transition-colors " +
                    (tiers.includes(t)
                      ? "border-navy-700 bg-navy-700/15 text-navy-700 dark:text-navy-300"
                      : "border-border text-muted-foreground hover:border-border-strong")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" disabled={pending} onClick={handleSaveDetails}>
              Salvar alterações
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function Toggle({
  enabled,
  onClick,
  disabled,
}: {
  enabled: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
        (enabled ? "bg-olive-600" : "bg-ink-600")
      }
    >
      <span
        className={
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform " +
          (enabled ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}
