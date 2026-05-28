"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatMoney } from "@/lib/utils/format";
import { runAiAudit } from "@/app/(app)/ir/[year]/auditoria/_actions/run-ai-audit";
import type { AuditAiResult, Finding } from "@/services/ai/tax-audit";

/**
 * Painel de auditoria fiscal via IA. Botão dispara análise de todos os números
 * do ano e exibe achados priorizados (omissões, classificação errada, etc).
 */
export function AiAuditPanel({ year }: { year: number }) {
  const [isRunning, startRun] = useTransition();
  const [result, setResult] = useState<AuditAiResult | null>(null);

  function run() {
    startRun(async () => {
      const res = await runAiAudit(year);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      toast.success(
        `Análise concluída — ${res.result.findings.length} ${res.result.findings.length === 1 ? "achado" : "achados"}`,
      );
    });
  }

  const healthCfg = result ? HEALTH_CONFIG[result.overall_health] : null;

  return (
    <Panel className="mb-5 border-navy-700/30">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
            Auditoria com IA
          </span>
        }
        meta={result ? `${result.findings.length} achados` : "antes de fechar a declaração"}
      />

      {!result ? (
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Roda uma análise inteligente sobre seus rendimentos, bens e dedutíveis pra
              encontrar lacunas comuns: meses faltando no plano de saúde, dividendos que
              sumiram, classificação errada de renda fixa, deduções esquecidas. Não
              substitui contador — é um segundo par de olhos antes do envio.
            </p>
          </div>
          <Button variant="primary" onClick={run} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
            ) : (
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
            )}
            {isRunning ? "Analisando…" : "Rodar análise"}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {healthCfg ? (
            <div className={`rounded-[8px] border p-4 ${healthCfg.bg}`}>
              <div className="flex items-start gap-3">
                <healthCfg.Icon
                  className={`w-5 h-5 shrink-0 mt-0.5 ${healthCfg.iconClass}`}
                  strokeWidth={1.7}
                />
                <div className="flex-1">
                  <div className={`font-mono text-[10.5px] uppercase tracking-[0.14em] font-medium ${healthCfg.titleClass}`}>
                    {healthCfg.label}
                  </div>
                  <p className="text-[13px] leading-relaxed mt-1.5">{result.summary}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Modelo recomendado */}
          <div className="rounded-[8px] border border-border p-4 bg-surface">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1.5">
              Modelo recomendado
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[20px] capitalize">
                {result.recommended_model}
              </span>
              <Badge tone="navy">IA</Badge>
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-1.5">
              {result.recommended_model_reasoning}
            </p>
          </div>

          {/* Achados */}
          {result.findings.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Nenhum achado relevante. Você pode prosseguir com o fechamento.
            </p>
          ) : (
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
                Achados ({result.findings.length})
              </div>
              <ul className="space-y-2.5">
                {result.findings
                  .slice()
                  .sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity))
                  .map((f, i) => (
                    <FindingCard key={i} finding={f} />
                  ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-[11.5px] text-faint-foreground">
              Análise não substitui contador. Use como segunda revisão.
            </p>
            <Button variant="ghost" onClick={run} disabled={isRunning}>
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
              ) : (
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
              )}
              Rodar novamente
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const cfg = SEVERITY_CONFIG[finding.severity];
  return (
    <li className={`rounded-[8px] border p-3.5 ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        <cfg.Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconClass}`} strokeWidth={1.8} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[13.5px]">{finding.title}</span>
            <Badge tone={cfg.badgeTone}>{cfg.label}</Badge>
            <Badge tone="neutral">{CATEGORY_LABELS[finding.category]}</Badge>
            {finding.estimated_impact_brl != null && finding.estimated_impact_brl !== 0 ? (
              <span
                className={`font-mono text-[11px] tabular-nums ${finding.estimated_impact_brl > 0 ? "text-olive-700 dark:text-olive-300" : "text-rust-700 dark:text-rust-300"}`}
              >
                {finding.estimated_impact_brl > 0 ? "+" : "−"}
                {formatMoney(Math.abs(finding.estimated_impact_brl))}
              </span>
            ) : null}
          </div>
          <p className="text-[12.5px] mt-1.5 leading-relaxed text-muted-foreground">
            {finding.description}
          </p>
          <p className="text-[12.5px] mt-1.5 leading-relaxed">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Sugestão ·{" "}
            </span>
            {finding.suggestion}
          </p>
        </div>
      </div>
    </li>
  );
}

function sevWeight(s: Finding["severity"]): number {
  if (s === "critical") return 3;
  if (s === "warning") return 2;
  return 1;
}

const SEVERITY_CONFIG: Record<
  Finding["severity"],
  {
    label: string;
    bg: string;
    iconClass: string;
    badgeTone: "rust" | "gold" | "navy";
    Icon: typeof AlertTriangle;
  }
> = {
  critical: {
    label: "crítico",
    bg: "bg-rust-50/30 dark:bg-rust-950/10 border-rust-200 dark:border-rust-900/40",
    iconClass: "text-rust-700 dark:text-rust-400",
    badgeTone: "rust",
    Icon: AlertTriangle,
  },
  warning: {
    label: "atenção",
    bg: "bg-gold-50/30 dark:bg-gold-950/10 border-gold-200 dark:border-gold-900/40",
    iconClass: "text-gold-700 dark:text-gold-400",
    badgeTone: "gold",
    Icon: AlertCircle,
  },
  info: {
    label: "info",
    bg: "bg-navy-50/30 dark:bg-navy-950/10 border-navy-200 dark:border-navy-900/40",
    iconClass: "text-navy-700 dark:text-navy-300",
    badgeTone: "navy",
    Icon: Info,
  },
};

const HEALTH_CONFIG: Record<
  AuditAiResult["overall_health"],
  { label: string; bg: string; iconClass: string; titleClass: string; Icon: typeof CheckCircle2 }
> = {
  good: {
    label: "Tudo certo",
    bg: "bg-olive-50/30 dark:bg-olive-950/10 border-olive-200 dark:border-olive-900/40",
    iconClass: "text-olive-700 dark:text-olive-300",
    titleClass: "text-olive-700 dark:text-olive-300",
    Icon: CheckCircle2,
  },
  needs_review: {
    label: "Revisar antes de enviar",
    bg: "bg-gold-50/30 dark:bg-gold-950/10 border-gold-200 dark:border-gold-900/40",
    iconClass: "text-gold-700 dark:text-gold-400",
    titleClass: "text-gold-700 dark:text-gold-300",
    Icon: AlertCircle,
  },
  concerning: {
    label: "Ainda falta coisa importante",
    bg: "bg-rust-50/30 dark:bg-rust-950/10 border-rust-200 dark:border-rust-900/40",
    iconClass: "text-rust-700 dark:text-rust-400",
    titleClass: "text-rust-700 dark:text-rust-300",
    Icon: AlertTriangle,
  },
};

const CATEGORY_LABELS: Record<Finding["category"], string> = {
  rendimentos: "rendimentos",
  bens: "bens",
  dividas: "dívidas",
  dedutiveis: "dedutíveis",
  imposto: "imposto",
  classificacao: "classificação",
  outros: "outros",
};
