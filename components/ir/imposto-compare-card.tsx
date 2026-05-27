import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { ImpostoResult } from "@/services/ir/imposto";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function ImpostoCompareCard({ imposto }: { imposto: ImpostoResult }) {
  const completoWins = imposto.recommendation === "completo";

  return (
    <div>
      {/* Fonte da tabela IRPF aplicada — transparência sobre qual MP/Lei vigora */}
      <div className="flex items-baseline gap-2 mb-3 font-mono text-[10.5px] tracking-[0.06em] text-faint-foreground">
        <span className="text-muted-foreground uppercase tracking-[0.14em]">
          Ano-base {imposto.year}
        </span>
        <span>·</span>
        <span>Tabela: {imposto.taxTableSource}</span>
        {imposto.taxTableIsEstimate ? (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-gold-700 dark:text-gold-500">
              <AlertTriangle className="w-3 h-3" strokeWidth={1.7} />
              estimativa (oficial pendente)
            </span>
          </>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <ModelCard
          title="Modelo Completo"
          isRecommended={completoWins}
          base={imposto.completo.base}
          grossTax={imposto.completo.grossTax}
          irrf={imposto.completo.irrfRetained}
          netDue={imposto.completo.netDue}
          extras={[
            { label: "Total deduções", value: imposto.completo.totalDeducoes },
            { label: "Educação", value: imposto.completo.educacaoLimitApplied, hint: imposto.completo.educacaoLimitApplied < imposto.completo.educacao ? `limitado · digitou R$ ${fmtBRL(imposto.completo.educacao)}` : undefined },
            { label: "Saúde (sem limite)", value: imposto.completo.saude },
            { label: "PGBL/previdência", value: imposto.completo.pgblLimitApplied, hint: imposto.completo.pgblLimitApplied < imposto.completo.pgblPrev ? `limite 12% da renda · digitou R$ ${fmtBRL(imposto.completo.pgblPrev)}` : undefined },
            { label: "Dependentes", value: imposto.dependentsDeduction, hint: `${imposto.numDependents} × R$ 2.275,08` },
          ]}
        />
        <ModelCard
          title="Modelo Simples"
          isRecommended={!completoWins}
          base={imposto.simples.base}
          grossTax={imposto.simples.grossTax}
          irrf={imposto.simples.irrfRetained}
          netDue={imposto.simples.netDue}
          extras={[
            { label: "Desconto padrão (20%)", value: imposto.simples.descontoPadrao, hint: "limite R$ 16.754,34" },
          ]}
        />
      </div>
      <div className="pt-3 border-t border-border flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">
          {imposto.savings > 0 ? (
            <>
              Diferença entre modelos:{" "}
              <span className="font-mono text-foreground">R$ {fmtBRL(imposto.savings)}</span>
            </>
          ) : (
            <>Modelos empatados</>
          )}
        </span>
        <Badge tone={completoWins ? "olive" : "navy"}>
          Recomendado: {completoWins ? "Completo" : "Simples"}
        </Badge>
      </div>
    </div>
  );
}

function ModelCard({
  title,
  isRecommended,
  base,
  grossTax,
  irrf,
  netDue,
  extras,
}: {
  title: string;
  isRecommended: boolean;
  base: number;
  grossTax: number;
  irrf: number;
  netDue: number;
  extras: { label: string; value: number; hint?: string }[];
}) {
  const isRefund = netDue < 0;
  return (
    <div
      className={cn(
        "rounded-[10px] border bg-surface p-4",
        isRecommended ? "border-olive-600/40 ring-1 ring-olive-600/20" : "border-border",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-[16px] tracking-[-0.01em] text-foreground">
          {title}
        </span>
        {isRecommended ? <Badge tone="olive">recomendado</Badge> : null}
      </div>
      <div className="space-y-1 text-[12px] mb-3">
        {extras.map((e) => (
          <div key={e.label} className="flex justify-between gap-2 items-baseline">
            <span className="text-muted-foreground">{e.label}</span>
            <span className="font-mono tabular-nums text-foreground">R$ {fmtBRL(e.value)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3 space-y-1.5 text-[12.5px]">
        <div className="flex justify-between gap-2 items-baseline">
          <span className="text-muted-foreground">Base de cálculo</span>
          <span className="font-mono tabular-nums">R$ {fmtBRL(base)}</span>
        </div>
        <div className="flex justify-between gap-2 items-baseline">
          <span className="text-muted-foreground">Imposto bruto</span>
          <span className="font-mono tabular-nums">R$ {fmtBRL(grossTax)}</span>
        </div>
        <div className="flex justify-between gap-2 items-baseline">
          <span className="text-muted-foreground">(-) IRRF retido</span>
          <span className="font-mono tabular-nums text-faint-foreground">R$ {fmtBRL(irrf)}</span>
        </div>
      </div>
      <div className="border-t border-border-strong mt-3 pt-3 flex justify-between items-baseline">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
          {isRefund ? "Restituição" : "Imposto a pagar"}
        </span>
        <span
          className={cn(
            "font-mono text-[20px] tabular-nums font-medium",
            isRefund ? "text-olive-700" : "text-rust-600",
          )}
        >
          R$ {fmtBRL(Math.abs(netDue))}
        </span>
      </div>
    </div>
  );
}
