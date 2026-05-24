"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { updateSystemSetting } from "@/services/system-settings.actions";
import type { Tables, Json } from "@/types/database";

type Setting = Tables<"system_settings">;

const LABELS: Record<string, { title: string; help?: string; danger?: boolean }> = {
  maintenance_mode: {
    title: "Modo manutenção",
    help: "Quando ligado, usuários veem tela de bloqueio. Apenas superadmins continuam usando o app.",
    danger: true,
  },
  signup_enabled: {
    title: "Cadastros abertos",
    help: "Quando desligado, novos usuários não conseguem criar conta. Login continua funcionando.",
  },
  default_trial_days: {
    title: "Dias de trial padrão",
    help: "Quantos dias de trial novos households recebem ao se cadastrar (quando billing estiver ativo).",
  },
  platform_name: {
    title: "Nome da plataforma",
    help: "Aparece em e-mails, abas do navegador e cabeçalhos. Mude com cuidado.",
  },
};

export function SystemSettingsToggles({ settings }: { settings: Setting[] }) {
  const booleans = settings.filter((s) => typeof s.value === "boolean");
  const numbers = settings.filter((s) => typeof s.value === "number");
  const strings = settings.filter((s) => typeof s.value === "string");

  return (
    <div className="space-y-5">
      {booleans.length > 0 ? (
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Kill switches
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-4">
            Liga/desliga partes do app pra todos os usuários
          </p>
          <div className="space-y-3">
            {booleans.map((s) => (
              <BoolRow key={s.key} setting={s} />
            ))}
          </div>
        </Panel>
      ) : null}

      {numbers.length > 0 ? (
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Valores numéricos
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-4">
            Parâmetros operacionais
          </p>
          <div className="space-y-4">
            {numbers.map((s) => (
              <ValueRow key={s.key} setting={s} type="number" />
            ))}
          </div>
        </Panel>
      ) : null}

      {strings.length > 0 ? (
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
            Textos e identidade
          </div>
          <p className="text-[11.5px] text-faint-foreground mb-4">
            Strings visíveis ao usuário
          </p>
          <div className="space-y-4">
            {strings.map((s) => (
              <ValueRow key={s.key} setting={s} type="text" />
            ))}
          </div>
        </Panel>
      ) : null}

      {settings.length === 0 ? (
        <Panel className="!py-12 text-center">
          <div className="text-[13px] text-muted-foreground">
            Nenhuma configuração definida. Aplique a migration de admin pra
            popular as configurações iniciais.
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function BoolRow({ setting }: { setting: Setting }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const meta = LABELS[setting.key] ?? { title: setting.key };
  const enabled = setting.value === true;

  const handleToggle = async () => {
    const next = !enabled;
    if (meta.danger && next) {
      const ok = await confirm({
        title: `Ligar ${meta.title}?`,
        description:
          "Isso afeta TODOS os usuários da plataforma imediatamente. Confirma?",
        confirmLabel: "Ligar agora",
        destructive: true,
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const r = await updateSystemSetting(setting.key, next as Json);
      if (r.error) toast.error(r.error);
      else toast.success(next ? "Ligado." : "Desligado.");
    });
  };

  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-medium text-foreground">
            {meta.title}
          </span>
          <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em]">
            {setting.key}
          </span>
          {meta.danger ? <Badge tone="rust">crítico</Badge> : null}
          <Badge tone={enabled ? "olive" : "neutral"}>
            {enabled ? "ON" : "OFF"}
          </Badge>
        </div>
        {meta.help ? (
          <p className="text-[12px] text-muted-foreground mt-1">{meta.help}</p>
        ) : null}
        {setting.description ? (
          <p className="text-[11.5px] text-faint-foreground mt-0.5">
            {setting.description}
          </p>
        ) : null}
      </div>
      <Toggle
        enabled={enabled}
        disabled={pending}
        onClick={handleToggle}
        danger={meta.danger}
      />
    </div>
  );
}

function ValueRow({
  setting,
  type,
}: {
  setting: Setting;
  type: "number" | "text";
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<string>(String(setting.value ?? ""));
  const meta = LABELS[setting.key] ?? { title: setting.key };
  const original = String(setting.value ?? "");
  const dirty = value !== original;

  const handleSave = () => {
    const parsed: Json =
      type === "number" ? (Number(value) as Json) : (value as Json);
    if (type === "number" && (Number.isNaN(parsed as number) || (parsed as number) < 0)) {
      toast.error("Valor inválido.");
      return;
    }
    startTransition(async () => {
      const r = await updateSystemSetting(setting.key, parsed);
      if (r.error) toast.error(r.error);
      else toast.success("Salvo.");
    });
  };

  return (
    <div>
      <Field
        label={
          <span className="flex items-center gap-2">
            {meta.title}
            <span className="font-mono text-[10px] text-faint-foreground tracking-[0.04em] font-normal">
              {setting.key}
            </span>
          </span>
        }
        htmlFor={`s-${setting.key}`}
        hint={meta.help ?? setting.description ?? undefined}
      >
        <div className="flex gap-2">
          <Input
            id={`s-${setting.key}`}
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min={type === "number" ? 0 : undefined}
            step={type === "number" ? "any" : undefined}
            className="flex-1"
          />
          <Button
            variant={dirty ? "primary" : "ghost"}
            disabled={!dirty || pending}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.7} />
            Salvar
          </Button>
        </div>
      </Field>
    </div>
  );
}

function Toggle({
  enabled,
  onClick,
  disabled,
  danger,
}: {
  enabled: boolean;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 " +
        (enabled
          ? danger
            ? "bg-rust-600"
            : "bg-olive-600"
          : "bg-ink-600")
      }
      aria-pressed={enabled}
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
