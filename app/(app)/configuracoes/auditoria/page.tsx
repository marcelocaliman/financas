import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { runAudit, type Finding, type Severity } from "@/services/audit";
import { AuditFixButton } from "@/components/configuracoes/audit-fix-button";
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; icon: typeof AlertCircle }> = {
  critical: {
    label: "Crítico",
    color: "text-rust-700 dark:text-rust-400",
    bg: "bg-rust-50 dark:bg-rust-900/20 border-rust-600/30",
    icon: AlertCircle,
  },
  major: {
    label: "Maior",
    color: "text-gold-700 dark:text-gold-400",
    bg: "bg-gold-50 dark:bg-gold-900/20 border-gold-600/30",
    icon: AlertTriangle,
  },
  minor: {
    label: "Menor",
    color: "text-navy-700 dark:text-navy-300",
    bg: "bg-navy-50 dark:bg-navy-900/20 border-navy-600/30",
    icon: Info,
  },
  info: {
    label: "Info",
    color: "text-muted-foreground",
    bg: "bg-surface-muted border-border",
    icon: Info,
  },
};

export default async function AuditoriaPage() {
  const audit = await runAudit();

  // Agrupa por área
  const byArea = new Map<string, Finding[]>();
  for (const f of audit.findings) {
    const list = byArea.get(f.area) ?? [];
    list.push(f);
    byArea.set(f.area, list);
  }

  const totalIssues = audit.counts.critical + audit.counts.major + audit.counts.minor;
  const isHealthy = totalIssues === 0;

  return (
    <>
      <PageHeader
        eyebrow="Saúde · Auditoria"
        title={
          isHealthy ? (
            <>
              Sistema <em className="not-italic font-display italic text-olive-700 dark:text-olive-500">saudável.</em>
            </>
          ) : (
            <>
              <em className="not-italic font-display italic text-gold-700 dark:text-gold-500">{totalIssues}</em>{" "}
              {totalIssues === 1 ? "ponto" : "pontos"} de atenção.
            </>
          )
        }
        subtitle={`Atualizado em ${new Date(audit.generatedAt).toLocaleString("pt-BR")}. Cada página recarrega revalida tudo.`}
      />

      {/* Sumário */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCell
          severity="critical"
          count={audit.counts.critical}
        />
        <SummaryCell severity="major" count={audit.counts.major} />
        <SummaryCell severity="minor" count={audit.counts.minor} />
        <SummaryCell severity="info" count={audit.counts.info} />
      </div>

      {/* Lista de problemas por área */}
      {isHealthy ? (
        <Panel className="!py-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-olive-700 dark:text-olive-500 mx-auto mb-3" strokeWidth={1.5} />
          <div className="font-display text-[22px] tracking-[-0.02em] text-foreground">
            Tudo em ordem.
          </div>
          <p className="text-[13.5px] text-muted-foreground mt-2">
            Nenhuma inconsistência detectada nos dados, sincronização ou cálculos.
          </p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {Array.from(byArea.entries()).map(([area, items]) => (
            <Panel key={area}>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
                {area} · {items.length} {items.length === 1 ? "item" : "itens"}
              </div>
              <div className="space-y-2.5">
                {items.map((f, i) => (
                  <FindingRow key={i} finding={f} />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

function SummaryCell({ severity, count }: { severity: Severity; count: number }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <div className={`rounded-[10px] border ${meta.bg} px-4 py-3`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${meta.color}`} strokeWidth={1.7} />
        <span className={`font-mono text-[10.5px] uppercase tracking-[0.14em] font-medium ${meta.color}`}>
          {meta.label}
          {count !== 1 ? "s" : ""}
        </span>
      </div>
      <div className={`font-mono text-[28px] tabular-nums mt-1 ${meta.color}`}>{count}</div>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const meta = SEVERITY_META[finding.severity];
  return (
    <div className={`rounded-[8px] border ${meta.bg} px-4 py-2.5`}>
      <div className="flex items-start gap-2.5">
        <Badge tone={
          finding.severity === "critical" ? "rust" :
          finding.severity === "major" ? "gold" :
          finding.severity === "minor" ? "navy" : "neutral"
        }>
          {meta.label}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-foreground font-medium leading-snug">
            {finding.title}
          </div>
          {finding.detail ? (
            <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              {finding.detail}
            </div>
          ) : null}
          {finding.fix?.action ? (
            <AuditFixButton action={finding.fix.action} label={finding.fix.label} />
          ) : finding.fix?.href ? (
            <Link
              href={finding.fix.href}
              className="inline-block mt-2 text-[11.5px] font-mono uppercase tracking-[0.08em] text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 underline"
            >
              → {finding.fix.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
