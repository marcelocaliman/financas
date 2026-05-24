"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  createAccountantNote,
  resolveAccountantNote,
  deleteAccountantNote,
} from "@/services/accountant-notes.actions";
import type { Tables, AccountantNoteSection } from "@/types/database";

const SECTION_LABELS: Record<AccountantNoteSection, string> = {
  bens: "Bens e Direitos",
  rendimentos: "Rendimentos",
  renda_variavel: "Renda Variável",
  imposto: "Imposto",
  pagamentos: "Pagamentos",
  geral: "Geral",
};

export function NotesPanel({
  householdId,
  year,
  notes,
  isAccountant,
}: {
  householdId: string;
  year: number;
  notes: (Tables<"accountant_notes"> & {
    accountant?: { full_name: string } | null;
  })[];
  /** Se true, contador (pode criar/deletar). Senão, titular (só lê + resolve) */
  isAccountant: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [section, setSection] = useState<AccountantNoteSection>("geral");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!content.trim()) {
      toast.error("Escreva algo.");
      return;
    }
    startTransition(async () => {
      const r = await createAccountantNote({ householdId, year, section, content });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Anotação adicionada.");
        setContent("");
        setShowForm(false);
        router.refresh();
      }
    });
  };

  const handleResolve = (id: string) => {
    startTransition(async () => {
      const r = await resolveAccountantNote(id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Resolvida.");
        router.refresh();
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const r = await deleteAccountantNote(id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Apagada.");
        router.refresh();
      }
    });
  };

  const openNotes = notes.filter((n) => n.status === "open");

  return (
    <Panel className="mb-5 border-navy-700/30">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
            {isAccountant ? "Suas anotações" : "Anotações do contador"}
            {openNotes.length > 0 ? (
              <Badge tone="gold">{openNotes.length} aberta{openNotes.length === 1 ? "" : "s"}</Badge>
            ) : null}
          </span>
        }
        meta={isAccountant ? "Comentários visíveis pro cliente" : "Pendências apontadas pelo seu contador"}
      />

      {notes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          {isAccountant
            ? "Nenhuma anotação ainda. Use pra apontar pendências (\"falta comprovante de plano de saúde\", \"confirmar data da compra de PETR4\", etc.)"
            : "Seu contador ainda não escreveu nada aqui."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className={
                "border rounded-[8px] p-3 " +
                (n.status === "resolved"
                  ? "border-border bg-surface-muted/40 opacity-60"
                  : "border-navy-700/20 bg-navy-700/5")
              }
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone="navy">{SECTION_LABELS[n.section]}</Badge>
                  {n.status === "resolved" ? (
                    <Badge tone="olive">resolvida</Badge>
                  ) : null}
                  <span className="text-[11px] text-faint-foreground font-mono">
                    {n.accountant?.full_name ?? "—"} ·{" "}
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {n.status === "open" && !isAccountant ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResolve(n.id)}
                      disabled={pending}
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2} />
                    </Button>
                  ) : null}
                  {isAccountant ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(n.id)}
                      disabled={pending}
                      className="text-rust-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="text-[13px] text-foreground whitespace-pre-wrap">{n.content}</p>
            </li>
          ))}
        </ul>
      )}

      {isAccountant ? (
        showForm ? (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <Field label="Seção" htmlFor="note-section">
              <Select
                value={section}
                onValueChange={(v) => setSection(v as AccountantNoteSection)}
              >
                <SelectTrigger id="note-section"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SECTION_LABELS) as AccountantNoteSection[]).map((s) => (
                    <SelectItem key={s} value={s}>{SECTION_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Anotação" htmlFor="note-content">
              <Textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Ex: Precisa do comprovante do plano Unimed pra confirmar dedução"
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleCreate} disabled={pending}>
                {pending ? "Salvando…" : "Publicar"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)} className="mt-3">
            <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
            Nova anotação
          </Button>
        )
      ) : null}
    </Panel>
  );
}
