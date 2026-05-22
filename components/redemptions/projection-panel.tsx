"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { projectFiveYears } from "@/lib/financial/projection";
import { formatMoney } from "@/lib/utils/format";

export function ProjectionPanel({
  initialBalance,
  selicAnnualPct,
  initialMonthly,
}: {
  initialBalance: number;
  selicAnnualPct: number;
  initialMonthly: number;
}) {
  const [monthly, setMonthly] = useState(initialMonthly);
  const projection = projectFiveYears(initialBalance, selicAnnualPct, monthly, 60);
  const lastPoint = projection.points[projection.points.length - 1];

  return (
    <Panel className="mt-5">
      <PanelHeader
        title="Em 5 anos"
        meta={`Cenário com Selic em ${selicAnnualPct.toFixed(2)}% · pode variar`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <ProjCell
          label="Total sacado"
          value={formatMoney(projection.totalSacado)}
          sub="60 meses"
        />
        <ProjCell
          label="Patrimônio"
          value={formatMoney(lastPoint.balance)}
          sub={lastPoint.balance > initialBalance ? "cresceu apesar dos saques" : "depois dos saques"}
          tone={lastPoint.balance > initialBalance ? "positive" : "default"}
        />
        <ProjCell
          label="Renda no último mês"
          value={formatMoney(projection.lastMonthYield)}
          sub="estimada"
        />
        <ProjCell
          label="Saque sugerido"
          value={formatMoney(monthly)}
          sub="/mês"
          tone="navy"
        />
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-[12px] mb-2">
          <span className="text-muted-foreground">Valor sugerido mensal</span>
          <span className="font-mono font-medium text-foreground">{formatMoney(monthly)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(5000, monthly * 2)}
          step={100}
          value={monthly}
          onChange={(e) => setMonthly(Number(e.target.value))}
          className="w-full h-1 bg-surface-muted rounded-full appearance-none cursor-pointer accent-navy-800"
        />
      </div>

      <ProjectionChart points={projection.points} />

      <div className="flex justify-between text-[10.5px] font-mono text-faint-foreground tracking-[0.06em] mt-2">
        <span>HOJE</span>
        <span>+1A</span>
        <span>+2A</span>
        <span>+3A</span>
        <span>+4A</span>
        <span>+5 ANOS</span>
      </div>
    </Panel>
  );
}

function ProjCell({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "navy";
}) {
  const valueClass =
    tone === "positive" ? "text-olive-700" : tone === "navy" ? "text-navy-700" : "text-foreground";
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground mb-1 font-medium">
        {label}
      </div>
      <div className={`font-mono text-[18px] tracking-[-0.02em] ${valueClass}`}>{value}</div>
      {sub ? <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{sub}</div> : null}
    </div>
  );
}
