"use client";

import { useMemo, useState, useTransition } from "react";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseCsv, parseNumber, parseDate } from "@/lib/utils/csv";
import { parseOfx } from "@/lib/utils/ofx";
import {
  importTransactionsCSV,
  type ImportRow,
} from "@/services/transactions.import.actions";
import type { Currency, PaymentMethod, TransactionKind } from "@/types/database";

/**
 * Cada coluna do CSV é mapeada pra um destes campos.
 * O auto-detect bate o header contra os aliases case-insensitive.
 */
type FieldKey =
  | "date"
  | "description"
  | "amount"
  | "currency"
  | "kind"
  | "accountName"
  | "categoryName"
  | "paymentMethod"
  | "skip";

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: "skip", label: "— ignorar —" },
  { value: "date", label: "Data" },
  { value: "description", label: "Descrição" },
  { value: "amount", label: "Valor" },
  { value: "currency", label: "Moeda" },
  { value: "kind", label: "Tipo (receita/despesa)" },
  { value: "accountName", label: "Conta (nome)" },
  { value: "categoryName", label: "Categoria (nome)" },
  { value: "paymentMethod", label: "Forma de pagamento" },
];

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  date: ["data", "date", "dt", "dia"],
  description: ["descricao", "descrição", "description", "histórico", "historico", "memo", "desc"],
  amount: ["valor", "amount", "value", "montante", "qtd"],
  currency: ["moeda", "currency", "ccy"],
  kind: ["tipo", "kind", "type", "natureza"],
  accountName: ["conta", "account", "carteira"],
  categoryName: ["categoria", "category", "cat"],
  paymentMethod: ["forma_pagamento", "forma", "método", "metodo", "payment_method", "pagamento"],
  skip: [],
};

function autoDetect(header: string): FieldKey {
  const norm = header.toLowerCase().replace(/[^a-z0-9_ãáâéêíóôõúç]/gi, "").trim();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
    if (aliases.some((a) => a.toLowerCase().replace(/[^a-z0-9_]/g, "") === norm.replace(/[^a-z0-9_]/g, ""))) {
      return key;
    }
  }
  return "skip";
}

function normalizeKind(s: string): TransactionKind | null {
  const v = s.toLowerCase().trim();
  if (["receita", "income", "entrada", "credito", "crédito", "+"].includes(v)) return "income";
  if (["despesa", "expense", "saida", "saída", "debito", "débito", "-"].includes(v))
    return "expense";
  if (["transferencia", "transferência", "transfer"].includes(v)) return "transfer";
  if (v === "income" || v === "expense" || v === "transfer") return v as TransactionKind;
  return null;
}

function normalizeCurrency(s: string): Currency {
  const v = s.toUpperCase().trim();
  if (v === "EUR" || v === "€") return "EUR";
  if (v === "USD" || v === "US$" || v === "$") return "USD";
  return "BRL";
}

function normalizePaymentMethod(s: string): PaymentMethod | null {
  const v = s.toLowerCase().trim();
  if (["credit", "credito", "crédito"].includes(v)) return "credit";
  if (["debit", "debito", "débito"].includes(v)) return "debit";
  if (v === "pix") return "pix";
  if (["cash", "dinheiro", "espécie", "especie"].includes(v)) return "cash";
  if (["auto_debit", "débito automático", "debito automatico"].includes(v)) return "auto_debit";
  if (v === "transfer" || v === "transferência" || v === "transferencia") return "transfer";
  return null;
}

export function ImportTransactionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, FieldKey>>({});
  const [defaultKind, setDefaultKind] = useState<TransactionKind>("expense");
  const [pending, startTransition] = useTransition();
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const reset = () => {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImportErrors([]);
  };

  // Quando o user fecha o dialog, reseta tudo
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) reset();
  }

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const isOfx = /\.ofx$/i.test(file.name) || /<OFX>/i.test(text.slice(0, 500));

      if (isOfx) {
        // Parse OFX → converte pra formato CSV-like (headers + rows)
        const ofx = parseOfx(text);
        if (ofx.transactions.length === 0) {
          toast.error("OFX sem transações ou formato não suportado.");
          return;
        }
        const hs = ["Data", "Descrição", "Valor", "Tipo"];
        const rs = ofx.transactions.map((t) => [
          t.date,
          t.description,
          Math.abs(t.amount).toFixed(2).replace(".", ","),
          t.amount >= 0 ? "receita" : "despesa",
        ]);
        setHeaders(hs);
        setRows(rs);
        setMapping({ 0: "date", 1: "description", 2: "amount", 3: "kind" });
        toast.success(
          `OFX detectado: ${ofx.transactions.length} transação(ões) entre ${ofx.startDate ?? "?"} e ${ofx.endDate ?? "?"}.`,
        );
        setStep(2);
        return;
      }

      const { headers: hs, rows: rs } = parseCsv(text);
      if (hs.length === 0) {
        toast.error("CSV vazio ou ilegível.");
        return;
      }
      setHeaders(hs);
      setRows(rs);
      const initial: Record<number, FieldKey> = {};
      hs.forEach((h, i) => {
        initial[i] = autoDetect(h);
      });
      setMapping(initial);
      setStep(2);
    } catch (err) {
      toast.error(`Erro ao ler arquivo: ${err instanceof Error ? err.message : "desconhecido"}`);
    }
  };

  /** Constrói as ImportRow do payload final a partir do mapping atual. */
  const builtRows = useMemo<ImportRow[]>(() => {
    if (step < 2) return [];
    const findCol = (field: FieldKey): number => {
      for (const [k, v] of Object.entries(mapping)) {
        if (v === field) return Number(k);
      }
      return -1;
    };
    const colDate = findCol("date");
    const colDesc = findCol("description");
    const colAmount = findCol("amount");
    const colCurrency = findCol("currency");
    const colKind = findCol("kind");
    const colAccount = findCol("accountName");
    const colCategory = findCol("categoryName");
    const colPayment = findCol("paymentMethod");

    return rows.map((r): ImportRow => {
      const rawDate = colDate >= 0 ? (r[colDate] ?? "") : "";
      const rawAmount = colAmount >= 0 ? (r[colAmount] ?? "") : "";
      const rawCurrency = colCurrency >= 0 ? (r[colCurrency] ?? "") : "";
      const rawKind = colKind >= 0 ? (r[colKind] ?? "") : "";
      const rawPayment = colPayment >= 0 ? (r[colPayment] ?? "") : "";

      const parsedAmount = parseNumber(rawAmount) ?? 0;
      // Convenção: valor negativo → despesa, positivo → receita (se o kind não vier explícito)
      const explicitKind = normalizeKind(rawKind);
      const kind: TransactionKind =
        explicitKind ?? (parsedAmount < 0 ? "expense" : defaultKind);

      return {
        date: parseDate(rawDate) ?? "",
        description: colDesc >= 0 ? (r[colDesc] ?? "").trim() : "",
        amount: Math.abs(parsedAmount),
        currency: normalizeCurrency(rawCurrency),
        kind,
        accountName: colAccount >= 0 ? (r[colAccount] ?? "").trim() : "",
        categoryName: colCategory >= 0 ? (r[colCategory] ?? "").trim() || null : null,
        paymentMethod: normalizePaymentMethod(rawPayment),
      };
    });
  }, [rows, mapping, step, defaultKind]);

  const handleImport = () => {
    startTransition(async () => {
      const r = await importTransactionsCSV(builtRows);
      if (r.errors && r.errors.length > 0) {
        setImportErrors(r.errors.map((e) => e.error));
        setStep(3);
        return;
      }
      const inserted = r.inserted ?? 0;
      const skipped = r.skippedDuplicates?.length ?? 0;
      const insertedMsg = `${inserted} transação${inserted === 1 ? "" : "s"} importada${inserted === 1 ? "" : "s"}`;
      const skippedMsg = skipped > 0
        ? ` · ${skipped} pulada${skipped === 1 ? "" : "s"} (já existia${skipped === 1 ? "" : "m"})`
        : "";
      toast.success(insertedMsg + skippedMsg);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[820px]">
        <DialogHeader
          eyebrow={`Importação · passo ${step}/3`}
          title={
            step === 1
              ? "Envie um CSV."
              : step === 2
                ? "Confira as colunas."
                : "Validação."
          }
          description={
            step === 1
              ? "Cabeçalho na primeira linha. Aceita separadores , ou ; e valores em qualquer formato (BR/EN/EU)."
              : step === 2
                ? "Selecione qual campo cada coluna do CSV representa. O app tenta detectar automaticamente pelos nomes."
                : importErrors.length > 0
                  ? "Encontramos problemas. Corrija o CSV e tente de novo."
                  : "Tudo pronto."
          }
        />

        {/* ============================== STEP 1 ============================== */}
        {step === 1 ? (
          <UploadStep onFile={handleFile} />
        ) : null}

        {/* ============================== STEP 2 ============================== */}
        {step === 2 ? (
          <MappingStep
            headers={headers}
            rows={rows.slice(0, 5)}
            mapping={mapping}
            setMapping={setMapping}
            defaultKind={defaultKind}
            setDefaultKind={setDefaultKind}
            totalRows={rows.length}
          />
        ) : null}

        {/* ============================== STEP 3 ============================== */}
        {step === 3 ? <ErrorsStep errors={importErrors} /> : null}

        <DialogFooter>
          {step === 1 ? (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          ) : null}
          {step === 2 ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button type="button" variant="primary" onClick={handleImport} disabled={pending}>
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
                {pending ? "Importando…" : `Importar ${rows.length}`}
              </Button>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Voltar
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================================================================== */

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center justify-center gap-3 py-12 rounded-[10px] border-2 border-dashed cursor-pointer transition-colors ${
        dragging
          ? "border-navy-700 bg-navy-50/40"
          : "border-border hover:border-border-strong bg-surface"
      }`}
    >
      <Upload className="w-7 h-7 text-faint-foreground" strokeWidth={1.5} />
      <div className="text-center">
        <div className="text-[14px] font-medium text-foreground">
          Arraste CSV ou OFX aqui — ou clique
        </div>
        <div className="text-[12.5px] text-muted-foreground mt-1">
          CSV: cabeçalho na 1ª linha, UTF-8. OFX: extrato do banco (Itaú, Bradesco, Nubank, etc).
        </div>
      </div>
      <input
        type="file"
        accept=".csv,.ofx,text/csv,application/x-ofx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

/* ========================================================================== */

function MappingStep({
  headers,
  rows,
  mapping,
  setMapping,
  defaultKind,
  setDefaultKind,
  totalRows,
}: {
  headers: string[];
  rows: string[][];
  mapping: Record<number, FieldKey>;
  setMapping: (m: Record<number, FieldKey>) => void;
  defaultKind: TransactionKind;
  setDefaultKind: (k: TransactionKind) => void;
  totalRows: number;
}) {
  const used = new Set(Object.values(mapping));
  const hasKind = used.has("kind");

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-border bg-surface-muted px-4 py-3 text-[12.5px] text-muted-foreground flex items-start gap-2">
        <FileText className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.6} />
        <span>
          Mostrando as 5 primeiras de <b className="text-foreground">{totalRows}</b> linhas
          encontradas. Os mappings se aplicam a todas.
        </span>
      </div>

      {!hasKind ? (
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-muted-foreground">
            Sem coluna de “tipo” — assumir todas como
          </span>
          <Select
            value={defaultKind}
            onValueChange={(v) => setDefaultKind(v as TransactionKind)}
          >
            <SelectTrigger className="!w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11.5px] text-faint-foreground">
            (valores negativos viram despesas automaticamente)
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-border rounded-[10px]">
        <table className="w-full text-[12.5px]">
          <thead className="bg-surface-muted">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="text-left p-2 border-b border-border align-bottom min-w-[140px]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint-foreground font-medium mb-1.5">
                    {h || `Coluna ${i + 1}`}
                  </div>
                  <Select
                    value={mapping[i] ?? "skip"}
                    onValueChange={(v) => setMapping({ ...mapping, [i]: v as FieldKey })}
                  >
                    <SelectTrigger className="!h-7 !text-[11.5px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((o) => (
                        <SelectItem
                          key={o.value}
                          value={o.value}
                          // permite "skip" sempre; bloqueia se outra coluna já usa o campo
                          disabled={
                            o.value !== "skip" &&
                            o.value !== mapping[i] &&
                            Object.values(mapping).includes(o.value)
                          }
                        >
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                {headers.map((_, ci) => (
                  <td
                    key={ci}
                    className={`p-2 font-mono text-[11.5px] ${mapping[ci] === "skip" ? "text-faint-foreground" : "text-foreground"}`}
                  >
                    {r[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========================================================================== */

function ErrorsStep({ errors }: { errors: string[] }) {
  return (
    <div className="space-y-3">
      <div className="rounded-[10px] border border-rust-600/30 bg-rust-100/30 dark:bg-rust-700/10 px-4 py-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rust-600" strokeWidth={1.7} />
        <div>
          <div className="text-[13px] font-medium text-rust-600">
            {errors.length} problema{errors.length === 1 ? "" : "s"} encontrado{errors.length === 1 ? "" : "s"}
          </div>
          <div className="text-[12.5px] text-muted-foreground mt-0.5">
            Nada foi importado. Corrija o CSV e tente de novo.
          </div>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto rounded-[10px] border border-border p-3 space-y-1.5 text-[12.5px] font-mono">
        {errors.map((e, i) => (
          <div key={i} className="text-rust-600 break-words">
            · {e}
          </div>
        ))}
      </div>
    </div>
  );
}
