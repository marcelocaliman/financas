"use client";

import Link from "next/link";
import { Users, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Tables } from "@/types/database";

/**
 * Switcher pra alternar entre as declarações do casal (e visão conjunta).
 *
 * Usa query param ?filer=<id> — sem JS é puramente links Next.js.
 * "Conjunta" = sem query param (soma tudo do household).
 */
export function FilerSwitcher({
  year,
  filers,
  selectedId,
}: {
  year: number;
  filers: Tables<"ir_filers">[];
  selectedId: string | null;
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-[10px] bg-bone-100 dark:bg-ink-800 border border-border w-fit">
      <SwitcherButton
        href={`/ir/${year}`}
        label="Visão conjunta"
        icon={<Users className="w-3.5 h-3.5" strokeWidth={1.7} />}
        active={selectedId === null}
      />
      {filers.map((f) => (
        <SwitcherButton
          key={f.id}
          href={`/ir/${year}?filer=${f.id}`}
          label={f.full_name.split(" ")[0]}
          subLabel={f.is_primary ? "titular" : "cônjuge"}
          icon={<User className="w-3.5 h-3.5" strokeWidth={1.7} />}
          active={selectedId === f.id}
        />
      ))}
    </div>
  );
}

function SwitcherButton({
  href,
  label,
  subLabel,
  icon,
  active,
}: {
  href: string;
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium transition-colors",
        active
          ? "bg-white dark:bg-ink-950 text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
      {subLabel ? (
        <span className="text-[10.5px] text-faint-foreground ml-0.5">· {subLabel}</span>
      ) : null}
    </Link>
  );
}
