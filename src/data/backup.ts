import { db } from "@/data/db";
import { dumpVault, loadVault } from "@/vault/serialize";
import { pending } from "@/vault/pending";
import { useVault } from "@/vault/vault-store";
import { useUI } from "@/store/ui";
import { CURRENCIES, type Currency } from "@/money/currency";
import type { AppSettings } from "@/domain/types";

/**
 * Portabilidade (Fase 2): o usuário é DONO dos dados.
 * - JSON = backup/restauração completa (todas as tabelas), reaproveitando dump/loadVault.
 * - CSV = lista achatada pra interoperar (abrir no Excel/Sheets).
 * Tudo client-side; nada sai sem o usuário pedir.
 */

const APP_TAG = "nossasfinancas";
const FORMAT_VERSION = 1;

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Carimbo AAAA-MM-DD pro nome do arquivo (runtime, não workflow → Date é ok). */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── JSON: backup completo ───────────────────────────────────────────────────
export async function exportBackupJSON(): Promise<void> {
  const data = await dumpVault(db);
  const payload = { app: APP_TAG, format: FORMAT_VERSION, exportedAt: new Date().toISOString(), data };
  downloadFile(`nossasfinancas-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

/**
 * Importa um backup JSON: SUBSTITUI tudo, marca pendência e sobe pro servidor cifrado.
 * Como a importação é IRREVERSÍVEL (apaga as tabelas e sobrescreve o blob cifrado na
 * nuvem), validamos a fundo ANTES de tocar nos dados — um arquivo corrompido/incompatível
 * NUNCA pode zerar o vault em silêncio reportando "sucesso".
 */
export async function importBackupJSON(file: File): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("invalid-backup");
  }
  const p = parsed as { app?: string; format?: number; data?: Record<string, unknown> };
  // 1) Cabeçalho: app correto + formato conhecido (rejeita versões futuras incompatíveis).
  if (!p || typeof p !== "object" || p.app !== APP_TAG || p.format !== FORMAT_VERSION) {
    throw new Error("invalid-backup");
  }
  // 2) Forma de vault: toda chave é uma tabela conhecida e todo valor é um array.
  const data = p.data;
  if (!data || typeof data !== "object") throw new Error("invalid-backup");
  const tables = new Set(db.tables.map((t) => t.name));
  const keys = Object.keys(data);
  if (keys.length === 0 || keys.some((k) => !tables.has(k) || !Array.isArray(data[k]))) {
    throw new Error("invalid-backup");
  }
  // 3) Registro a registro: todo row é objeto com `id` string (chave primária de TODAS as
  //    tabelas) e os campos financeiros críticos têm o tipo certo — um JSON editado à mão ou
  //    corrompido não pode entrar, quebrar a UI (NaN, moeda inválida) e ainda subir pro servidor.
  const MONTH_RE = /^\d{4}-\d{2}$/;
  for (const k of keys) {
    for (const row of data[k] as unknown[]) {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("invalid-backup");
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string" || r.id.length === 0) throw new Error("invalid-backup");
      if ("amount" in r && r.amount != null && !(typeof r.amount === "number" && Number.isFinite(r.amount))) throw new Error("invalid-backup");
      if ("currency" in r && r.currency != null && !CURRENCIES.includes(r.currency as Currency)) throw new Error("invalid-backup");
      if ("month" in r && r.month != null && !(typeof r.month === "string" && MONTH_RE.test(r.month))) throw new Error("invalid-backup");
    }
  }
  // 4) Guarda: um backup VAZIO não pode apagar um vault populado (corrupção/erro de seleção).
  const totalRows = keys.reduce((s, k) => s + (data[k] as unknown[]).length, 0);
  const counts = await Promise.all(db.tables.map((t) => t.count()));
  const localEmpty = counts.every((c) => c === 0);
  if (totalRows === 0 && !localEmpty) throw new Error("invalid-backup");

  await loadVault(db, data as Record<string, unknown[]>);
  // Reancorar a moeda principal pelo singleton de settings do backup (validando a moeda).
  const settingsRows = (data.settings as AppSettings[] | undefined) ?? [];
  const settings = settingsRows.find((s) => s?.id === "settings") ?? settingsRows[0];
  const bc = settings?.baseCurrency;
  if (bc && CURRENCIES.includes(bc as Currency)) useUI.getState().setBaseCurrency(bc as Currency);
  pending.set();
  await useVault
    .getState()
    .push()
    .catch(() => {
      /* offline/falha → a flag pendente re-tenta no próximo unlock/online */
    });
}

// ── CSV: lista achatada pra interoperar ─────────────────────────────────────
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Cita se houver aspas, vírgula, ; ou QUEBRA (\n ou \r isolado) — evita partir linha no Excel.
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLS = ["tipo", "nome", "categoria", "moeda", "valor", "extra"] as const;

export async function exportCSV(): Promise<void> {
  const [assets, liabilities, expenses, incomes, snapshots, goals, dividends, subscriptions] = await Promise.all([
    db.assets.toArray(),
    db.liabilities.toArray(),
    db.expenses.toArray(),
    db.incomes.toArray(),
    db.netWorthSnapshots.toArray(),
    db.goals.toArray(),
    db.dividends.toArray(),
    db.subscriptions.toArray(),
  ]);

  const rows: Record<string, unknown>[] = [];
  for (const a of assets)
    rows.push({ tipo: "ativo", nome: a.name, categoria: a.classId, moeda: a.currency, valor: a.amount, extra: a.ticker ?? a.subtypeId ?? "" });
  for (const l of liabilities)
    rows.push({ tipo: "passivo", nome: l.name, categoria: l.typeId, moeda: l.currency, valor: l.amount, extra: l.installments ? `${l.installments}x` : "" });
  // Nome da fatura-pai, pra sinalizar itens DENTRO dela (senão um SUM ingênuo no Excel dupla-conta).
  const expName = new Map(expenses.map((e) => [e.id, e.name || e.categoryId]));
  for (const e of expenses)
    rows.push({ tipo: "gasto", nome: e.name, categoria: e.categoryId, moeda: e.currency, valor: e.amount, extra: e.parentId && expName.has(e.parentId) ? `${e.month} · dentro: ${expName.get(e.parentId)}` : e.month });
  for (const i of incomes)
    rows.push({ tipo: "receita", nome: i.name, categoria: i.categoryId, moeda: i.currency, valor: i.amount, extra: i.month });
  for (const s of snapshots)
    rows.push({ tipo: "historico", nome: s.month, categoria: "", moeda: s.currency, valor: s.amount, extra: s.contribution ?? "" });
  for (const g of goals)
    rows.push({ tipo: "objetivo", nome: g.name, categoria: "", moeda: g.currency, valor: g.current, extra: `alvo:${g.target}` });
  for (const d of dividends)
    rows.push({ tipo: "provento", nome: d.source, categoria: d.month, moeda: d.currency, valor: d.amount, extra: "" });
  for (const s of subscriptions)
    rows.push({ tipo: "assinatura", nome: s.name, categoria: s.cycle === "yearly" ? "anual" : "mensal", moeda: s.currency, valor: s.amount, extra: [s.startMonth ? `início ${s.startMonth}` : "", s.renewalDay ? `renova dia ${s.renewalDay}` : ""].filter(Boolean).join(" · ") });

  const head = CSV_COLS.join(",");
  const body = rows.map((r) => CSV_COLS.map((c) => csvCell(r[c])).join(",")).join("\n");
  // BOM (﻿) p/ o Excel abrir UTF-8 (acentos) corretamente.
  downloadFile(`nossasfinancas-${stamp()}.csv`, "﻿" + head + "\n" + body, "text/csv;charset=utf-8");
}
