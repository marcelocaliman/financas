"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmDocumentAction } from "@/app/(app)/inbox/_actions/confirm";
import { discardDocumentAction } from "@/app/(app)/inbox/_actions/discard";
import { reextractAction } from "@/app/(app)/inbox/_actions/upload";
import type { DocumentType, ExtractedData } from "@/services/inbox/document-types";
import { CURRENCY_SYMBOLS } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";

type AccountLite = { id: string; name: string; type: string; institution: string | null };
type FilerLite = { id: string; name: string };

/** Formata valor com o símbolo da moeda do DOCUMENTO (não R$ fixo). */
function money(v: number, currency?: string | null): string {
  const sym = CURRENCY_SYMBOLS[(currency ?? "BRL") as Currency] ?? "R$";
  return `${sym} ${v.toFixed(2).replace(".", ",")}`;
}

/**
 * Painel de review do documento extraído. Mostra o que a IA classificou/extraiu
 * pra você conferir e confirmar (ou descartar/re-extrair). Não edita os dados
 * inline — ajustes finos depois da aplicação são feitos em /transacoes.
 */
export function InboxReviewPanel({
  documentId,
  detectedType,
  extractedData,
  reviewedData,
  accounts,
  filers,
}: {
  documentId: string;
  detectedType: DocumentType;
  extractedData: ExtractedData["data"] | null;
  reviewedData: ExtractedData["data"] | null;
  accounts: AccountLite[];
  filers: FilerLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const data = (reviewedData ?? extractedData) as ExtractedData["data"];

  // Estados de input (campos que o user escolhe)
  const [accountId, setAccountId] = useState<string>(
    accounts.find((a) => requiredAccountTypes(detectedType).includes(a.type))?.id ?? "",
  );
  const [filerId, setFilerId] = useState<string>(
    filers.find((f) => f.name.toLowerCase().includes("marcelo"))?.id ?? filers[0]?.id ?? "",
  );

  const needsAccount = ["fatura_cartao", "holerite", "boleto", "extrato_bancario"].includes(
    detectedType,
  );
  const needsFiler = ["holerite", "recibo_medico"].includes(detectedType);

  const handleConfirm = () => {
    if (needsAccount && !accountId) {
      toast.error("Escolha uma conta.");
      return;
    }
    if (needsFiler && !filerId) {
      toast.error("Escolha um filer.");
      return;
    }
    startTransition(async () => {
      const r = await confirmDocumentAction({
        documentId,
        accountId: accountId || null,
        ownerFilerId: filerId || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const inserted = Object.values(r.createdIds ?? {}).reduce(
        (s, ids) => s + ids.length,
        0,
      );
      const skipped = r.skippedCount ?? 0;
      if (inserted === 0 && skipped > 0) {
        toast.success(
          `Nada novo: ${skipped} item(s) já existiam no app. Documento marcado como aplicado.`,
        );
      } else if (skipped > 0) {
        toast.success(`${inserted} novo(s) registro(s). ${skipped} já existiam (pulados).`);
      } else {
        toast.success(`${inserted} registro(s) aplicado(s).`);
      }
      router.push("/inbox");
    });
  };

  const handleDiscard = () => {
    startTransition(async () => {
      const r = await discardDocumentAction(documentId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Descartado.");
        router.push("/inbox");
      }
    });
  };

  const handleReextract = (forceType?: DocumentType) => {
    startTransition(async () => {
      const r = await reextractAction(documentId, forceType);
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          forceType
            ? `Re-extraído como ${TYPE_LABELS[forceType] ?? forceType}.`
            : "Re-extraído.",
        );
        router.refresh();
      }
    });
  };

  // Filtra contas relevantes pro tipo
  const accountOptions = accounts.filter((a) =>
    requiredAccountTypes(detectedType).includes(a.type),
  );

  return (
    <Panel>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
        Dados extraídos
      </div>

      {/* Summary do que será aplicado */}
      <DataSummary detectedType={detectedType} data={data} />

      {/* Inputs de configuração */}
      <div className="mt-5 pt-5 border-t border-border space-y-3">
        {needsAccount ? (
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium block mb-1.5">
              Conta destino
            </label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta…" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {a.institution ? `· ${a.institution}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {needsFiler ? (
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium block mb-1.5">
              Filer dono
            </label>
            <Select value={filerId} onValueChange={setFilerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o filer…" />
              </SelectTrigger>
              <SelectContent>
                {filers.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center gap-2">
        <Button onClick={handleConfirm} disabled={pending}>
          {pending ? "Aplicando…" : "Confirmar e aplicar"}
        </Button>
        <Button variant="ghost" onClick={() => handleReextract()} disabled={pending}>
          Re-extrair
        </Button>
        <Select
          value=""
          onValueChange={(v) => handleReextract(v as DocumentType)}
        >
          <SelectTrigger className="w-[180px] !h-8">
            <SelectValue placeholder="…como outro tipo" />
          </SelectTrigger>
          <SelectContent>
            {(
              [
                "fatura_cartao",
                "holerite",
                "nota_corretagem",
                "recibo_medico",
                "boleto",
                "extrato_bancario",
                "outros",
              ] as DocumentType[]
            ).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={handleDiscard} disabled={pending}>
          Descartar
        </Button>
      </div>
    </Panel>
  );
}

const TYPE_LABELS: Record<DocumentType, string> = {
  fatura_cartao: "Fatura de cartão",
  holerite: "Holerite",
  nota_corretagem: "Nota de corretagem",
  recibo_medico: "Recibo médico",
  boleto: "Boleto",
  extrato_bancario: "Extrato bancário",
  outros: "Outros",
};

function requiredAccountTypes(detectedType: DocumentType): string[] {
  switch (detectedType) {
    case "fatura_cartao":
      return ["credit_card"];
    case "holerite":
      return ["checking", "savings"];
    case "boleto":
      return ["checking", "savings", "cash"];
    case "extrato_bancario":
      return ["checking", "savings", "investment"];
    default:
      return ["checking", "savings", "cash", "investment", "credit_card"];
  }
}

/**
 * Resumo legível do que será aplicado, por tipo de documento.
 * Não edita os dados — só mostra. Edição inline pode vir em iteração futura.
 */
function DataSummary({
  detectedType,
  data,
}: {
  detectedType: DocumentType;
  data: ExtractedData["data"];
}) {
  if (detectedType === "fatura_cartao") {
    const d = data as Extract<ExtractedData, { type: "fatura_cartao" }>["data"];
    // Inclui estornos/créditos (amount<0): o applier os importa como receita,
    // então a revisão precisa mostrá-los (antes só contava amount>0).
    const newItems = d.items.filter((i) => !i.is_payment);
    const purchases = newItems.filter((i) => i.amount > 0).length;
    const refunds = newItems.filter((i) => i.amount < 0).length;
    return (
      <div className="space-y-2">
        <Row label="Total" value={money(d.total, d.currency)} />
        <Row label="Vencimento" value={d.due_date ?? "—"} />
        <Row
          label="Itens a importar"
          value={`${purchases} compra(s)${refunds > 0 ? ` · ${refunds} estorno(s)` : ""}`}
        />
        {d.items.some((i) => i.is_payment) ? (
          <div className="text-[11.5px] text-muted-foreground italic mt-2">
            (Pagamento da fatura anterior será ignorado.)
          </div>
        ) : null}
        <details className="mt-3">
          <summary className="text-[11.5px] font-mono text-faint-foreground cursor-pointer">
            Ver itens ({newItems.length})
          </summary>
          <ul className="mt-2 space-y-1 max-h-[300px] overflow-y-auto">
            {newItems.map((it, i) => (
              <li key={i} className="text-[11.5px] flex justify-between gap-3 py-1 border-b border-border/40">
                <span className="text-foreground truncate">
                  {it.date} · {it.description}
                  {it.amount < 0 ? " · estorno" : ""}
                  {it.installment_current && it.installment_total
                    ? ` · ${it.installment_current}/${it.installment_total}`
                    : ""}
                </span>
                <span className={`font-mono tabular-nums shrink-0 ${it.amount < 0 ? "text-olive-700 dark:text-olive-500" : ""}`}>
                  {money(it.amount, d.currency)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }

  if (detectedType === "holerite") {
    const d = data as Extract<ExtractedData, { type: "holerite" }>["data"];
    return (
      <div className="space-y-2">
        <Row label="Empresa" value={d.payer_name} />
        <Row label="Funcionário" value={d.employee_name} />
        <Row label="Competência" value={d.competence_month} />
        <Row label="Salário bruto" value={money(d.gross_salary, d.currency)} />
        <Row label="INSS" value={money(d.inss_retained, d.currency)} />
        <Row label="IRRF" value={money(d.irrf_retained, d.currency)} />
        <Row label="Líquido" value={money(d.net_salary, d.currency)} />
        {d.is_thirteenth ? (
          <div className="text-[11.5px] text-olive-700 dark:text-olive-500 italic mt-2">
            13º salário — vai como rendimento exclusivo de fonte.
          </div>
        ) : null}
      </div>
    );
  }

  if (detectedType === "nota_corretagem") {
    const d = data as Extract<ExtractedData, { type: "nota_corretagem" }>["data"];
    return (
      <div className="space-y-2">
        <Row label="Corretora" value={d.broker_name} />
        <Row label="Data" value={d.trade_date} />
        <Row label="Operações" value={`${d.operations.length}`} />
        <Row label="Taxas totais" value={money(d.total_fees, d.currency)} />
        <details className="mt-3">
          <summary className="text-[11.5px] font-mono text-faint-foreground cursor-pointer">
            Ver operações
          </summary>
          <ul className="mt-2 space-y-1">
            {d.operations.map((op, i) => (
              <li key={i} className="text-[11.5px] flex justify-between gap-3 py-1 border-b border-border/40">
                <span>{op.ticker} · {op.side === "buy" ? "C" : "V"} {op.quantity}</span>
                <span className="font-mono">{money(op.unit_price, d.currency)}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }

  if (detectedType === "recibo_medico") {
    const d = data as Extract<ExtractedData, { type: "recibo_medico" }>["data"];
    return (
      <div className="space-y-2">
        <Row label="Prestador" value={d.provider_name} />
        <Row label="Tipo" value={d.kind} />
        <Row label="Data" value={d.payment_date} />
        <Row label="Valor" value={money(d.amount, d.currency)} />
        {d.patient_name ? <Row label="Paciente" value={d.patient_name} /> : null}
      </div>
    );
  }

  if (detectedType === "boleto") {
    const d = data as Extract<ExtractedData, { type: "boleto" }>["data"];
    return (
      <div className="space-y-2">
        <Row label="Beneficiário" value={d.payee_name} />
        <Row label="Vencimento" value={d.due_date} />
        <Row label="Valor" value={money(d.amount, d.currency)} />
        <Row label="Descrição" value={d.description} />
      </div>
    );
  }

  if (detectedType === "extrato_bancario") {
    const d = data as Extract<ExtractedData, { type: "extrato_bancario" }>["data"];
    return (
      <div className="space-y-2">
        <Row label="Banco" value={d.bank_name} />
        <Row label="Período" value={`${d.period_start} a ${d.period_end}`} />
        <Row label="Movimentos" value={`${d.movements.length}`} />
        <Row label="Saldo inicial" value={money(d.opening_balance, d.currency)} />
        <Row label="Saldo final" value={money(d.closing_balance, d.currency)} />
      </div>
    );
  }

  // Outros
  const d = data as Extract<ExtractedData, { type: "outros" }>["data"];
  return (
    <div className="space-y-2">
      <div className="text-[12.5px] text-muted-foreground italic mb-2">{d.summary}</div>
      <ul className="space-y-1">
        {d.key_facts.map((f, i) => (
          <li key={i}>
            <Row label={f.label} value={f.value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 text-[12.5px]">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint-foreground shrink-0">
        {label}
      </span>
      <span className="text-foreground font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}
