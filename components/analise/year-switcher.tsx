"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Navegador de ano pra visão "Ano" do Histórico. Mantém o view=ano e troca
 * só o parâmetro `year`. Default = ano corrente − 1 (ano fiscal mais relevante
 * pra IRPF na época da declaração).
 */
export function YearSwitcher({ current }: { current: number }) {
  const router = useRouter();
  const minYear = 2020;
  const maxYear = new Date().getUTCFullYear();

  const navigate = (year: number) => {
    router.push(`/analise?view=ano&year=${year}`);
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => navigate(current - 1)}
        disabled={current <= minYear}
        aria-label="Ano anterior"
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />
      </Button>
      <div className="font-mono text-[14px] font-medium px-2 tabular-nums w-14 text-center">
        {current}
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => navigate(current + 1)}
        disabled={current >= maxYear}
        aria-label="Próximo ano"
      >
        <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
      </Button>
    </div>
  );
}
