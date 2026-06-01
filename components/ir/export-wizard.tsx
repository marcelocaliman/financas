"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { ChecklistReport } from "@/services/ir/checklist";

export type ExportSummary = {
  recommendation: "simples" | "completo";
  /** netDue do modelo recomendado: positivo = a pagar, negativo = a restituir. */
  netDue: number;
  baseTributavel: number;
  totalBens: number;
  taxTableSource: string;
  taxTableIsEstimate: boolean;
};

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STEPS = ["Prontidão", "Conferir", "Exportar"] as const;

/**
 * Assistente de exportação do IRPF — torna o "transmitir" um ato deliberado e
 * seguro. Antes era só dois botões soltos no header; agora um fluxo de 3 passos:
 *   1. Prontidão  — roda o checklist (erros BLOQUEIAM, avisos pedem ciência).
 *   2. Conferir   — mostra imposto a pagar/restituir, base e bens; pede confirmação.
 *   3. Exportar   — só então libera os arquivos.
 * Renda não classificada (estimativa provisória) bloqueia tudo, com link pra revisão.
 */
export function ExportWizard({
  year,
  cpf,
  checklist,
  summary,
  hasUnclassified,
  unclassifiedTotal,
}: {
  year: number;
  cpf: string;
  checklist: ChecklistReport;
  summary: ExportSummary;
  hasUnclassified: boolean;
  unclassifiedTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [ackNumbers, setAckNumbers] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const filerId = searchParams.get("filer");

  const { counts } = checklist;
  const hasErrors = counts.error > 0;
  const hasWarnings = counts.warning > 0;
  const blocked = hasUnclassified || hasErrors;

  function reset() {
    setStep(0);
    setAckWarnings(false);
    setAckNumbers(false);
  }

  const downloadBlob = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: "dec" | "txt") => {
    if (!cpf && !filerId) {
      toast.error("Cadastre seu CPF em Configurações antes de exportar.");
      return;
    }
    startTransition(async () => {
      try {
        const qs = new URLSearchParams({ year: String(year), format });
        if (filerId) qs.set("filerId", filerId);
        const res = await fetch(`/api/ir/export?${qs.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
          toast.error(err.error ?? "Falha na exportação");
          return;
        }
        const data = await res.json();
        const filename = format === "dec" ? data.filename : `IRPF_${year}_relatorio.txt`;
        const mime = format === "dec" ? "application/octet-stream" : "text/plain";
        const content = format === "dec" ? data.content : data.humanReadable;
        downloadBlob(filename, content, mime);
        toast.success("Arquivo gerado.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha na exportação";
        toast.error(msg);
      }
    });
  };

  const canAdvanceFrom0 = !blocked && (!hasWarnings || ackWarnings);
  const canAdvanceFrom1 = ackNumbers;

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.7} />
        Exportar declaração
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="!max-w-lg">
          <DialogHeader
            eyebrow={`IRPF ${year + 1} · ano-base ${year}`}
            title="Exportar declaração"
            description="Confira a prontidão e os números antes de gerar os arquivos."
          />

          {/* Stepper */}
          <ol className="flex items-center gap-1.5 mb-1">
            {STEPS.map((label, i) => (
              <li key={label} className="flex-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "shrink-0 grid place-items-center w-5 h-5 rounded-full text-[10.5px] font-mono font-medium transition-colors",
                    i < step
                      ? "bg-olive-600 text-white"
                      : i === step
                        ? "bg-navy-700 text-white"
                        : "bg-surface-muted text-faint-foreground",
                  )}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[11.5px] truncate",
                    i === step ? "text-foreground font-medium" : "text-faint-foreground",
                  )}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 ? (
                  <span className="flex-1 h-px bg-border" />
                ) : null}
              </li>
            ))}
          </ol>

          <div className="min-h-[180px] py-2">
            {step === 0 ? (
              <StepReadiness
                checklist={checklist}
                year={year}
                hasUnclassified={hasUnclassified}
                unclassifiedTotal={unclassifiedTotal}
                hasWarnings={hasWarnings}
                ackWarnings={ackWarnings}
                setAckWarnings={setAckWarnings}
              />
            ) : step === 1 ? (
              <StepReview
                summary={summary}
                ackNumbers={ackNumbers}
                setAckNumbers={setAckNumbers}
                year={year}
              />
            ) : (
              <StepExport pending={pending} onExport={handleExport} />
            )}
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (step === 0 ? setOpen(false) : setStep((s) => s - 1))}
            >
              {step === 0 ? (
                "Cancelar"
              ) : (
                <>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} />
                  Voltar
                </>
              )}
            </Button>
            {step < 2 ? (
              <Button
                variant="primary"
                size="sm"
                disabled={step === 0 ? !canAdvanceFrom0 : !canAdvanceFrom1}
                onClick={() => setStep((s) => s + 1)}
              >
                Continuar
                <ArrowRight className="w-3.5 h-3.5 ml-1" strokeWidth={1.8} />
              </Button>
            ) : (
              <span className="text-[11.5px] text-faint-foreground">
                Os arquivos são auxiliares — confira no programa oficial.
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepReadiness({
  checklist,
  year,
  hasUnclassified,
  unclassifiedTotal,
  hasWarnings,
  ackWarnings,
  setAckWarnings,
}: {
  checklist: ChecklistReport;
  year: number;
  hasUnclassified: boolean;
  unclassifiedTotal: number;
  hasWarnings: boolean;
  ackWarnings: boolean;
  setAckWarnings: (v: boolean) => void;
}) {
  const { items, counts } = checklist;
  const sorted = [...items].sort((a, b) => sevRank(a.severity) - sevRank(b.severity));

  if (hasUnclassified) {
    return (
      <div className="rounded-[8px] border border-gold-600/40 bg-gold-100/40 dark:bg-gold-700/10 p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-gold-700 shrink-0 mt-0.5" strokeWidth={1.8} />
          <div>
            <p className="text-[13px] text-foreground font-medium">
              Há R$ {fmtBRL(unclassifiedTotal)} em renda não classificada
            </p>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              Enquanto houver renda sem classificação, a estimativa é provisória e
              o export fica bloqueado. Resolva no modo revisão — leva poucos minutos.
            </p>
            <Link
              href={`/ir/${year}/revisao`}
              className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-medium text-navy-700 dark:text-navy-300"
            >
              Revisar agora
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 text-[11.5px] font-mono">
        <span className="inline-flex items-center gap-1 text-olive-700 dark:text-olive-500">
          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} /> {counts.ok}
        </span>
        <span className="inline-flex items-center gap-1 text-gold-700">
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} /> {counts.warning}
        </span>
        <span className="inline-flex items-center gap-1 text-rust-600">
          <XCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> {counts.error}
        </span>
      </div>

      <ul className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
        {sorted.map((it) => (
          <li
            key={it.id}
            className={cn(
              "rounded-[7px] border px-3 py-2",
              it.severity === "error"
                ? "border-rust-600/30 bg-rust-50/40 dark:bg-rust-700/10"
                : it.severity === "warning"
                  ? "border-gold-600/30 bg-gold-100/30 dark:bg-gold-700/10"
                  : "border-border bg-surface-muted/40",
            )}
          >
            <div className="flex items-start gap-2">
              <SeverityIcon severity={it.severity} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-foreground leading-snug">{it.title}</p>
                {it.detail ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {it.detail}
                  </p>
                ) : null}
                {it.link ? (
                  <Link
                    href={it.link.href}
                    className="inline-flex items-center gap-1 mt-1 text-[11.5px] font-medium text-navy-700 dark:text-navy-300"
                  >
                    {it.link.label}
                    <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {counts.error > 0 ? (
        <p className="text-[11.5px] text-rust-600">
          Corrija os {counts.error} erro(s) acima — o programa da Receita rejeitaria a declaração.
        </p>
      ) : hasWarnings ? (
        <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-bone-100 dark:bg-ink-800 border border-border cursor-pointer">
          <input
            type="checkbox"
            checked={ackWarnings}
            onChange={(e) => setAckWarnings(e.target.checked)}
            className="mt-0.5 accent-navy-700"
          />
          <span className="text-[12px] text-foreground leading-relaxed">
            Li os {counts.warning} aviso(s) e quero seguir mesmo assim.
          </span>
        </label>
      ) : (
        <div className="flex items-center gap-2 text-[12.5px] text-olive-700 dark:text-olive-500">
          <ShieldCheck className="w-4 h-4" strokeWidth={1.8} />
          Tudo certo — pode seguir.
        </div>
      )}
    </div>
  );
}

function StepReview({
  summary,
  ackNumbers,
  setAckNumbers,
  year,
}: {
  summary: ExportSummary;
  ackNumbers: boolean;
  setAckNumbers: (v: boolean) => void;
  year: number;
}) {
  const isRestituir = summary.netDue < 0;
  const valor = Math.abs(summary.netDue);
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-[10px] border p-4",
          isRestituir
            ? "border-olive-600/30 bg-olive-50 dark:bg-olive-700/10"
            : "border-navy-600/30 bg-navy-50/50 dark:bg-navy-700/10",
        )}
      >
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          {isRestituir ? "Imposto a restituir" : "Imposto a pagar"} ·{" "}
          modelo {summary.recommendation === "completo" ? "completo" : "simplificado"}
        </div>
        <div
          className={cn(
            "font-mono text-[26px] tabular-nums mt-1",
            isRestituir ? "text-olive-700 dark:text-olive-500" : "text-foreground",
          )}
        >
          R$ {fmtBRL(valor)}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
        <Row label="Base tributável" value={`R$ ${fmtBRL(summary.baseTributavel)}`} />
        <Row label="Total de bens (31/12)" value={`R$ ${fmtBRL(summary.totalBens)}`} />
      </dl>

      <p className="text-[11px] text-faint-foreground leading-relaxed">
        Tabela: {summary.taxTableSource}
        {summary.taxTableIsEstimate ? " (estimada — confirme quando a oficial sair)" : ""}.
        Confira esses números com seus informes do ano {year} antes de transmitir.
      </p>

      <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-bone-100 dark:bg-ink-800 border border-border cursor-pointer">
        <input
          type="checkbox"
          checked={ackNumbers}
          onChange={(e) => setAckNumbers(e.target.checked)}
          className="mt-0.5 accent-navy-700"
        />
        <span className="text-[12px] text-foreground leading-relaxed">
          Conferi os valores acima com meus informes de rendimentos.
        </span>
      </label>
    </div>
  );
}

function StepExport({
  pending,
  onExport,
}: {
  pending: boolean;
  onExport: (format: "dec" | "txt") => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => onExport("txt")}
        className="w-full flex items-start gap-3 rounded-[8px] border border-border-strong px-4 py-3 text-left hover:bg-surface-muted disabled:opacity-50 transition-colors"
      >
        <FileText className="w-4 h-4 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />
        <span>
          <span className="block text-[13px] font-medium text-foreground">
            Relatório IRPF (TXT)
          </span>
          <span className="block text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
            Completo e formatado pra você copiar seção por seção no programa oficial
            da Receita. É o que a maioria usa.
          </span>
        </span>
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => onExport("dec")}
        className="w-full flex items-start gap-3 rounded-[8px] border border-border-strong px-4 py-3 text-left hover:bg-surface-muted disabled:opacity-50 transition-colors"
      >
        <Download className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.7} />
        <span>
          <span className="block text-[13px] font-medium text-foreground">
            Estrutura técnica
          </span>
          <span className="block text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
            Formato pipe-delimited pra um contador conferir. NÃO importa direto no
            programa oficial.
          </span>
        </span>
      </button>

      {pending ? (
        <p className="text-[12px] text-muted-foreground">Gerando arquivo…</p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface-muted/40 px-3 py-2">
      <dt className="text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-mono">
        {label}
      </dt>
      <dd className="font-mono text-[14px] tabular-nums text-foreground mt-0.5">{value}</dd>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: "ok" | "warning" | "error" }) {
  if (severity === "error")
    return <XCircle className="w-3.5 h-3.5 text-rust-600 shrink-0 mt-0.5" strokeWidth={1.8} />;
  if (severity === "warning")
    return <AlertTriangle className="w-3.5 h-3.5 text-gold-700 shrink-0 mt-0.5" strokeWidth={1.8} />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-olive-700 dark:text-olive-500 shrink-0 mt-0.5" strokeWidth={1.8} />;
}

function sevRank(s: "ok" | "warning" | "error"): number {
  return s === "error" ? 0 : s === "warning" ? 1 : 2;
}
