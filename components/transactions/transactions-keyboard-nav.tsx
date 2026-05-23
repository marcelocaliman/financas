"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const KEY_TO_KIND: Record<string, string | null> = {
  a: null,         // Todas → remove ?kind
  r: "income",
  d: "expense",
  t: "transfer",
};

/**
 * Atalhos da página /transacoes: A/R/D/T mudam o filtro `kind` via URL.
 * Mesma estética do KeyboardNav genérico (hint no rodapé).
 */
export function TransactionsKeyboardNav({
  currentKind,
}: {
  currentKind: string; // "all" | "income" | "expense" | "transfer"
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (!(key in KEY_TO_KIND)) return;
      e.preventDefault();
      setActive(key);
      setTimeout(() => setActive(null), 400);

      const nextKind = KEY_TO_KIND[key];
      const sp = new URLSearchParams(searchParams.toString());
      if (nextKind === null) sp.delete("kind");
      else sp.set("kind", nextKind);
      sp.delete("page");
      startTransition(() => router.push(`${pathname}?${sp.toString()}`));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pathname, router, searchParams]);

  const items = [
    { key: "a", label: "Todas", value: "all" },
    { key: "r", label: "Receitas", value: "income" },
    { key: "d", label: "Despesas", value: "expense" },
    { key: "t", label: "Transferências", value: "transfer" },
  ];

  return (
    <div
      className={`mt-8 pt-5 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-mono text-faint-foreground ${
        pending ? "opacity-60" : ""
      }`}
    >
      <span className="uppercase tracking-[0.14em] font-medium">Atalhos</span>
      {items.map((i) => (
        <span key={i.key} className="inline-flex items-center gap-1.5">
          <kbd
            className={`px-1.5 py-0.5 rounded border border-border bg-surface text-foreground font-medium uppercase transition-all ${
              active === i.key
                ? "bg-navy-700 text-white border-navy-700 scale-110"
                : currentKind === i.value
                  ? "border-navy-700 text-navy-700 dark:text-navy-300"
                  : ""
            }`}
          >
            {i.key}
          </kbd>
          {i.label}
        </span>
      ))}
    </div>
  );
}
