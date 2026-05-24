"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function YearSwitcher({
  householdId,
  years,
  currentYear,
}: {
  householdId: string;
  years: number[];
  currentYear: number;
}) {
  const router = useRouter();
  if (years.length <= 1) return null;
  const sorted = [...years].sort((a, b) => b - a);
  return (
    <Select
      value={String(currentYear)}
      onValueChange={(v) => router.push(`/contador/${householdId}/ir/${v}`)}
    >
      <SelectTrigger className="w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sorted.map((y) => (
          <SelectItem key={y} value={String(y)}>
            Ano-base {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
