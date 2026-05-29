"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (lastPage === 0) return null;

  const goTo = (next: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === 0) sp.delete("page");
    else sp.set("page", String(next));
    router.push(`${pathname}?${sp.toString()}`);
  };

  const start = page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex items-center justify-between mt-5 px-1">
      <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.04em]">
        Mostrando {start}–{end} de {total}
      </div>
      <div className="flex items-center gap-1">
        <Tooltip content="Página anterior">
          <Button
            size="icon"
            variant="ghost"
            disabled={page === 0}
            onClick={() => goTo(page - 1)}
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.7} />
          </Button>
        </Tooltip>
        <span className="font-mono text-[12.5px] mx-2 text-foreground">
          {page + 1} / {lastPage + 1}
        </span>
        <Tooltip content="Próxima página">
          <Button
            size="icon"
            variant="ghost"
            disabled={page >= lastPage}
            onClick={() => goTo(page + 1)}
            aria-label="Próxima"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.7} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
