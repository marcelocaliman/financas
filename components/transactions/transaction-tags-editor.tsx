"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { Tag as TagIcon, X, Plus } from "lucide-react";
import { toast } from "sonner";
import * as Popover from "@radix-ui/react-popover";
import { setTransactionTags } from "@/services/transactions.actions";
import { cn } from "@/lib/utils/cn";

/**
 * Editor compacto de tags pra uma transação. Renderiza:
 *  - Chips pequenos com as tags existentes (clicar X remove)
 *  - Botão "+" abre popover com input pra adicionar nova tag
 *
 * Sem dropdown de tags conhecidas (free-form) — UX simples. Caller passa
 * tags sugeridas se quiser autocomplete (futuro).
 */
export function TransactionTagsEditor({
  transactionId,
  tags: initialTags,
  knownTags = [],
}: {
  transactionId: string;
  tags: string[];
  /** Lista de tags já usadas pra autocomplete */
  knownTags?: string[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const save = (newTags: string[]) => {
    setTags(newTags);
    startTransition(async () => {
      const r = await setTransactionTags(transactionId, newTags);
      if (r.error) {
        toast.error(r.error);
        setTags(tags); // reverte
      }
    });
  };

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (!clean) return;
    if (tags.includes(clean)) return;
    save([...tags, clean]);
    setDraft("");
    setAdding(false);
  };

  const removeTag = (tag: string) => {
    save(tags.filter((t) => t !== tag));
  };

  const suggestions = knownTags
    .filter((t) => !tags.includes(t) && t.includes(draft.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-[5px]",
            "bg-navy-50 dark:bg-navy-700/15 text-navy-700 dark:text-navy-300",
            "text-[10.5px] font-mono tracking-[0.04em]",
          )}
        >
          <Link
            href={`/transacoes?tag=${encodeURIComponent(tag)}`}
            className="hover:underline"
            title={`Filtrar por #${tag}`}
          >
            {tag}
          </Link>
          <button
            type="button"
            onClick={() => removeTag(tag)}
            disabled={pending}
            className="text-faint-foreground hover:text-rust-600 transition-colors"
            aria-label={`Remover tag ${tag}`}
          >
            <X className="w-2.5 h-2.5" strokeWidth={2} />
          </button>
        </span>
      ))}

      <Popover.Root open={adding} onOpenChange={setAdding}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px]",
              "text-faint-foreground hover:text-foreground hover:bg-surface-muted transition-colors",
              "text-[10.5px] font-mono lg:opacity-0 lg:group-hover:opacity-100",
              tags.length === 0 && "opacity-50",
            )}
            aria-label="Adicionar tag"
          >
            <Plus className="w-2.5 h-2.5" strokeWidth={2} />
            {tags.length === 0 ? "tag" : ""}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            sideOffset={4}
            className="z-50 rounded-[8px] border border-border-strong bg-surface shadow-md p-2 w-[200px] data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="flex items-center gap-1 mb-2">
              <TagIcon className="w-3 h-3 text-faint-foreground" strokeWidth={1.8} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Ex: viagem-italia"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(draft);
                  } else if (e.key === "Escape") {
                    setAdding(false);
                  }
                }}
                autoFocus
                className="flex-1 min-w-0 text-[12px] bg-transparent outline-none placeholder:text-faint-foreground"
              />
            </div>
            {suggestions.length > 0 ? (
              <ul className="space-y-0.5">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => addTag(s)}
                      className="w-full text-left px-2 py-1 rounded-[4px] hover:bg-surface-muted text-[12px] font-mono text-foreground"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : draft ? (
              <button
                type="button"
                onClick={() => addTag(draft)}
                className="w-full text-left px-2 py-1 rounded-[4px] hover:bg-surface-muted text-[12px] font-mono text-navy-700 dark:text-navy-300"
              >
                + criar &ldquo;{draft.toLowerCase()}&rdquo;
              </button>
            ) : (
              <p className="text-[11px] text-faint-foreground px-2 py-1 italic">
                Digite e Enter pra criar
              </p>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
