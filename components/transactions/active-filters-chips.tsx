"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Strip de chips dos filtros ativos. Cada chip mostra "chave: valor" e
 * tem um botão X pra remover (limpa o param e re-navega).
 *
 * Mapeia params conhecidos pra rótulos amigáveis. Params desconhecidos
 * são ignorados (não polui a UI com cruft do framework).
 */
export function ActiveFiltersChips({
  kindLabel,
  queryLabel,
  tagLabel,
  categoryLabel,
}: {
  kindLabel?: string | null;
  queryLabel?: string | null;
  tagLabel?: string | null;
  categoryLabel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const remove = (key: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete(key);
    sp.delete("page");
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  const removeAll = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("kind");
    sp.delete("q");
    sp.delete("tag");
    sp.delete("categoryId");
    sp.delete("page");
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  // Renderização de tag: se for portador, mostra só o nome
  const tagDisplay = tagLabel?.startsWith("portador:")
    ? `👤 ${tagLabel.replace("portador:", "")}`
    : tagLabel
      ? `#${tagLabel}`
      : null;

  const chips: Array<{ key: string; label: string }> = [];
  if (kindLabel) chips.push({ key: "kind", label: kindLabel });
  if (queryLabel) chips.push({ key: "q", label: `“${queryLabel}”` });
  if (categoryLabel) chips.push({ key: "categoryId", label: `🏷 ${categoryLabel}` });
  if (tagDisplay) chips.push({ key: "tag", label: tagDisplay });

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 mb-4", pending && "opacity-60")}>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mr-1">
        Filtros
      </span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => remove(c.key)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] bg-surface-muted border border-border text-[12px] text-foreground hover:bg-bone-100 transition-colors"
        >
          {c.label}
          <X className="w-3 h-3 text-faint-foreground" strokeWidth={1.8} />
        </button>
      ))}
      {chips.length > 1 ? (
        <button
          type="button"
          onClick={removeAll}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] text-rust-600 hover:text-rust-700 transition-colors"
        >
          Limpar todos
        </button>
      ) : null}
    </div>
  );
}
