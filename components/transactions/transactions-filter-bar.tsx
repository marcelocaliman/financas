"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";
import { MonthSwitcher } from "@/components/ui/month-switcher";

type Tab = { value: string; label: string; count?: number };

export function TransactionsFilterBar({
  current,
  tabs,
  monthStr,
  monthLabel,
  isCurrentMonth,
}: {
  current: string;
  tabs: Tab[];
  monthStr: string;
  monthLabel: string;
  isCurrentMonth: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") sp.delete(key);
    else sp.set(key, value);
    sp.delete("page"); // reset paginação ao filtrar
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 mb-6", pending && "opacity-60")}>
      {/* Mobile: tabs ocupam linha inteira (cada uma flex-1).
          Desktop: inline-flex normal. */}
      <div className="flex w-full sm:w-auto sm:inline-flex items-center gap-1 p-1 bg-surface-muted rounded-[10px]">
        {tabs.map((t) => {
          const active = current === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setParam("kind", t.value === "all" ? null : t.value)}
              className={cn(
                "flex-1 sm:flex-none px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium tracking-[-0.005em] transition-colors text-center whitespace-nowrap",
                active ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {typeof t.count === "number" ? (
                <span className="ml-1.5 font-mono text-[10.5px] text-faint-foreground">
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 min-w-[200px] max-w-[400px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint-foreground pointer-events-none"
          strokeWidth={2}
        />
        <Input
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Buscar descrição…"
          className="pl-9 h-10"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setParam("q", (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => setParam("q", e.target.value)}
        />
      </div>

      <MonthSwitcher
        currentMonth={monthStr}
        isCurrent={isCurrentMonth}
        label={monthLabel.split(" ")[0]}
      />
    </div>
  );
}
