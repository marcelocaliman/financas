"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAnnouncement,
  type AnnouncementActionState,
} from "@/services/announcements.actions";

export function NewAnnouncementForm() {
  const [state, action, pending] = useActionState<
    AnnouncementActionState | undefined,
    FormData
  >(createAnnouncement, undefined);

  useEffect(() => {
    if (state?.ok) toast.success("Anúncio criado.");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
        Novo anúncio
      </div>

      <Field label="Título" htmlFor="title" required>
        <Input id="title" name="title" required placeholder="Manutenção programada" />
      </Field>

      <Field label="Mensagem" htmlFor="body" hint="Suporta texto simples">
        <Textarea
          id="body"
          name="body"
          rows={3}
          placeholder="O app ficará indisponível das 02h às 04h do dia 25/05…"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Severidade" htmlFor="severity">
          <Select name="severity" defaultValue="info">
            <SelectTrigger id="severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info (navy)</SelectItem>
              <SelectItem value="warning">Warning (gold)</SelectItem>
              <SelectItem value="critical">Crítico (rust)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Target tier (opcional)" htmlFor="targetTier" hint="Vazio = todos">
          <Select name="targetTier" defaultValue="">
            <SelectTrigger id="targetTier">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os tiers</SelectItem>
              <SelectItem value="free">Só Free</SelectItem>
              <SelectItem value="pro">Só Pro</SelectItem>
              <SelectItem value="family">Só Family</SelectItem>
              <SelectItem value="lifetime">Só Lifetime</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Dispensável" htmlFor="dismissible">
          <div className="flex items-center gap-2 h-10">
            <input
              type="checkbox"
              id="dismissible"
              name="dismissible"
              defaultChecked
              className="w-4 h-4 accent-navy-700"
            />
            <label htmlFor="dismissible" className="text-[12.5px] text-foreground">
              Usuário pode fechar
            </label>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Início" htmlFor="startsAt" hint="Vazio = imediato">
          <Input id="startsAt" name="startsAt" type="datetime-local" />
        </Field>
        <Field label="Fim" htmlFor="endsAt" hint="Vazio = sem expiração">
          <Input id="endsAt" name="endsAt" type="datetime-local" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Link URL (opcional)" htmlFor="linkUrl">
          <Input id="linkUrl" name="linkUrl" type="url" placeholder="https://…" />
        </Field>
        <Field label="Label do link" htmlFor="linkLabel">
          <Input id="linkLabel" name="linkLabel" placeholder="Ler mais" />
        </Field>
      </div>

      {state?.error ? (
        <p className="text-[12.5px] text-rust-600">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Criando…" : "Criar anúncio"}
        </Button>
      </div>
    </form>
  );
}
