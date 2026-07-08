import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Plus, Trash2, Download, RefreshCw, ShieldCheck, Globe, AlertTriangle, CalendarClock, Table } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useIsPro } from "@/hooks/use-pro";
import { useProStore } from "@/store/pro";
import { useTaxItems, useTaxReturns } from "@/hooks/use-irpf";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";
import { buildSeedTaxItems, buildRollForward } from "@/finance/irpf-seed";
import { irpfSeedMapper } from "@/irpf/mapper";
import { itemIssues, countPending, diffPatrimonio } from "@/irpf/validate";
import { summarizeIncome } from "@/irpf/income";
import { buildBensCSV, buildDividasCSV, downloadCSV } from "@/irpf/irpf-csv";
import { IrpfReport } from "@/irpf/irpf-report";
import { BENS_GROUPS, DIVIDAS_CODES, groupName, codeName, isForeignCurrency, CODES_LAYOUT } from "@/irpf/codes";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { nameById } from "@/domain/taxonomy";
import { Money } from "@/components/common/money";
import type { TaxItem, TaxReturn } from "@/domain/irpf";
import { cn } from "@/lib/utils";

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto"; // mesma largura/estrutura das outras páginas
const currentYear = new Date().getFullYear();

/** Tela cheia do Organizador de IRPF — renderizada na casca (menu presente), igual a Config/Suporte. */
export function IrpfView() {
  const { t } = useTranslation();
  const { isPro, resolved } = useIsPro();
  const openPaywall = useProStore((s) => s.openPaywall);
  const returns = useTaxReturns();

  const latest = returns && returns.length ? Math.max(...returns.map((r) => r.baseYear)) : null;
  const [selYear, setSelYear] = useState<number | null>(null);
  const year = selYear ?? latest ?? currentYear - 1; // ano-base = último ano cheo por padrão
  const items = useTaxItems(year);

  return (
    <div className="min-h-screen view-fade-in">
      <section className="scroll-mt-24">
        <div className={cn(CONTAINER, GUTTERS, "pt-[108px] pb-7")}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2">{CODES_LAYOUT}</div>
              <h1 className="font-semibold text-[clamp(1.8rem,4vw,2.9rem)] tracking-[-0.04em] leading-[1.04]">
                {t("irpf.title")}
              </h1>
              <p className="text-[13px] text-muted mt-2 max-w-[54ch]">{t("irpf.subtitle")}</p>
            </div>
            {isPro ? (
              <YearPicker returns={returns} year={year} onPick={setSelYear} />
            ) : null}
          </div>
        </div>
        <div className="border-t border-border" />
      </section>

      <div className={cn(CONTAINER, GUTTERS, "py-8")}>
        {!resolved ? null : !isPro ? (
          <LockedPreview onUpgrade={() => openPaywall("irpf")} />
        ) : (
          <Organizer year={year} items={items} returns={returns} />
        )}
      </div>
      {isPro ? <IrpfReport year={year} /> : null}
    </div>
  );
}

function YearPicker({ returns, year, onPick }: { returns: { baseYear: number }[] | null; year: number; onPick: (y: number) => void }) {
  const { t } = useTranslation();
  const years = useMemo(() => {
    const set = new Set<number>((returns ?? []).map((r) => r.baseYear));
    set.add(year);
    for (let y = currentYear; y >= currentYear - 5; y--) set.add(y - 1);
    return [...set].sort((a, b) => b - a);
  }, [returns, year]);
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-muted">
      {t("irpf.baseYear")}
      <select
        value={year}
        onChange={(e) => onPick(Number(e.target.value))}
        className="h-9 rounded-[10px] border border-border bg-card2 px-3 text-[13px] font-semibold text-text tabular outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </label>
  );
}

/** Estado bloqueado (não-Pro): mostra o valor do recurso + CTA de assinatura. */
function LockedPreview({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation();
  const bullets = t("irpf.lockedBullets", { returnObjects: true }) as string[];
  return (
    <div className="rounded-[16px] border border-border bg-card p-6 sm:p-8 max-w-[640px] mx-auto text-center">
      <span className="grid place-items-center w-12 h-12 rounded-[14px] bg-accent-soft text-accent mx-auto">
        <Lock size={20} />
      </span>
      <h2 className="text-[19px] font-semibold tracking-[-0.02em] mt-4">{t("irpf.lockedTitle")}</h2>
      <p className="text-[13.5px] text-muted mt-2">{t("irpf.lockedDesc")}</p>
      <ul className="text-left text-[13px] text-muted mt-5 space-y-2 max-w-[420px] mx-auto">
        {(Array.isArray(bullets) ? bullets : []).map((b, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-accent shrink-0 mt-0.5" /> {b}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-6 h-11 px-6 rounded-[12px] bg-accent text-[#08130C] text-[14px] font-semibold hover:opacity-90 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {t("irpf.lockedCta")}
      </button>
    </div>
  );
}

/** O organizador em si (Pro): disclaimer + puxar + lista editável agrupada. */
function Organizer({ year, items, returns }: { year: number; items: TaxItem[] | null; returns: TaxReturn[] | null }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const assets = useLiveQuery(() => repository.listAssets()) ?? [];
  const liabilities = useLiveQuery(() => repository.listLiabilities()) ?? [];
  const list = useMemo(() => items ?? [], [items]);
  const diff = useMemo(() => diffPatrimonio(list, assets, liabilities), [list, assets, liabilities]);
  const pending = countPending(list);
  const newCount = diff.newAssets.length + diff.newLiabilities.length;
  const priorYear = useMemo(() => {
    const ys = (returns ?? []).map((r) => r.baseYear).filter((y) => y < year);
    return ys.length ? Math.max(...ys) : null;
  }, [returns, year]);
  const incomes = useLiveQuery(() => repository.listIncomes()) ?? [];
  const tax = useTaxonomy();
  const incomeSummary = useMemo(() => summarizeIncome(incomes, year), [incomes, year]);

  async function ensureReturn() {
    if (!(await repository.getTaxReturn(String(year)))) {
      await actions.putTaxReturn({ id: String(year), baseYear: year, reportingCurrency: "BRL", status: "draft", updatedAt: Date.now() });
    }
  }

  async function pull() {
    setBusy(true);
    try {
      await ensureReturn();
      const [curAssets, curLiabs, existing] = await Promise.all([
        repository.listAssets(),
        repository.listLiabilities(),
        repository.listTaxItems(year),
      ]);
      const fresh = buildSeedTaxItems(year, curAssets, curLiabs, existing, irpfSeedMapper);
      if (fresh.length) await actions.putTaxItems(fresh);
    } finally {
      setBusy(false);
    }
  }

  /** Traz os itens do ano anterior: o valor de 31/12 vira a coluna "ano anterior" e você só atualiza o novo. */
  async function rollForward() {
    if (priorYear == null) return;
    setBusy(true);
    try {
      const prev = await repository.listTaxItems(priorYear);
      if (!prev.length) return;
      await ensureReturn();
      await actions.putTaxItems(buildRollForward(prev, year));
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    await ensureReturn();
    await actions.putTaxItem({
      id: crypto.randomUUID(),
      baseYear: year,
      kind: "asset",
      group: "",
      code: "",
      discriminacao: "",
      currency: "BRL",
      valorAnoBase: 0,
      fields: {},
      source: "manual",
    });
  }

  /** PDF via impressão: marca o body (o CSS mostra #irpf-report) e abre o diálogo de impressão. */
  function printIRPF() {
    const prev = document.title;
    document.title = `Organizador de IRPF ${year}`;
    const cleanup = () => {
      document.title = prev;
      document.body.classList.remove("print-irpf");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.classList.add("print-irpf");
    window.print();
  }
  function downloadCsvs() {
    downloadCSV(`irpf-${year}-bens-e-direitos.csv`, buildBensCSV(list));
    if (list.some((i) => i.kind === "debt")) downloadCSV(`irpf-${year}-dividas.csv`, buildDividasCSV(list));
  }

  const bens = list.filter((i) => i.kind === "asset");
  const dividas = list.filter((i) => i.kind === "debt");
  const bensByGroup = useMemo(() => {
    const m = new Map<string, TaxItem[]>();
    for (const it of bens) (m.get(it.group) ?? m.set(it.group, []).get(it.group)!).push(it);
    return [...m.entries()].sort((a, b) => (a[0] || "zz").localeCompare(b[0] || "zz"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  const empty = list.length === 0;

  return (
    <div className="space-y-5">
      {/* Aviso de honestidade — permanente */}
      <div className="flex items-start gap-2.5 rounded-[12px] border border-border bg-card2/50 px-4 py-3 text-[12.5px] text-muted">
        <ShieldCheck size={16} className="text-accent shrink-0 mt-0.5" />
        <span>{t("irpf.disclaimer")}</span>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={pull}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-accent text-[#08130C] text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {t("irpf.pull")}
        </button>
        <button
          type="button"
          onClick={addManual}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border border-border bg-card text-[13px] font-medium text-text hover:border-border-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Plus size={15} /> {t("irpf.addItem")}
        </button>
        {!empty ? (
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={printIRPF} className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-accent text-[#08130C] text-[13px] font-semibold hover:opacity-90 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <Download size={15} /> {t("irpf.docPdf")}
            </button>
            <button type="button" onClick={downloadCsvs} className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border border-border bg-card text-[13px] font-medium text-text hover:border-border-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <Table size={15} /> {t("irpf.docCsv")}
            </button>
          </div>
        ) : null}
      </div>

      {pending > 0 ? (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-[color-mix(in_oklab,#e0a33c_40%,transparent)] bg-[color-mix(in_oklab,#e0a33c_9%,transparent)] px-4 py-2.5 text-[12.5px] text-text">
          <AlertTriangle size={15} className="text-[#e0a33c] shrink-0" /> {t("irpf.pendingBanner", { n: pending })}
        </div>
      ) : null}
      {newCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-border bg-card2/50 px-4 py-2.5 text-[12.5px] text-muted">
          <RefreshCw size={15} className="text-accent shrink-0" />
          <span>{t("irpf.newBanner", { n: newCount })}</span>
          <button type="button" onClick={pull} className="ml-auto text-accent font-medium hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded">{t("irpf.pull")}</button>
        </div>
      ) : null}
      {diff.orphans.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-[12px] border border-border bg-card2/50 px-4 py-2.5 text-[12.5px] text-muted">
          <CalendarClock size={15} className="text-faint shrink-0 mt-0.5" /> {t("irpf.orphanBanner", { n: diff.orphans.length })}
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-[16px] border border-dashed border-border p-8 text-center">
          <p className="text-[13.5px] text-muted">{t("irpf.emptyState")}</p>
          {priorYear != null ? (
            <button type="button" onClick={rollForward} disabled={busy} className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-[10px] border border-border bg-card text-[12.5px] font-medium text-text hover:border-border-strong disabled:opacity-60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <RefreshCw size={14} /> {t("irpf.rollForward", { year: priorYear })}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {bensByGroup.map(([group, list]) => (
            <section key={group || "sem"} className="rounded-[16px] border border-border bg-card overflow-hidden">
              <div className="flex items-baseline justify-between px-4 sm:px-5 py-3 border-b border-border">
                <div className="eyebrow">{group ? `${group} · ${groupName(group)}` : t("irpf.noCode")}</div>
                <div className="eyebrow">{list.length} {t(list.length === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}</div>
              </div>
              <div className="divide-y divide-border">
                {list.map((it) => <Row key={it.id} item={it} />)}
              </div>
            </section>
          ))}

          {dividas.length ? (
            <section className="rounded-[16px] border border-border bg-card overflow-hidden">
              <div className="flex items-baseline justify-between px-4 sm:px-5 py-3 border-b border-border">
                <div className="eyebrow">{t("irpf.debtsSection")}</div>
                <div className="eyebrow">{dividas.length} {t(dividas.length === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}</div>
              </div>
              <div className="divide-y divide-border">
                {dividas.map((it) => <Row key={it.id} item={it} />)}
              </div>
            </section>
          ) : null}
        </>
      )}

      {incomeSummary.length ? (
        <section className="rounded-[16px] border border-border bg-card overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-border">
            <div className="eyebrow">{t("irpf.incomeSection", { year })}</div>
          </div>
          <div className="px-4 sm:px-5 py-3.5 space-y-2">
            <p className="text-[11.5px] text-faint">{t("irpf.incomeHint")}</p>
            {incomeSummary.map((r) => (
              <div key={r.categoryId + r.currency} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-muted truncate">{nameById(tax.incomeCategories, r.categoryId) || t("irpf.incomeUncat")}</span>
                <Money value={r.total} currency={r.currency} className="tabular font-medium shrink-0" />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Uma linha de bem/dívida — código (grupo+código), discriminação e valor de 31/12 editáveis.
 *  Texto/números usam estado LOCAL (o input reflete na hora, sem pulo de cursor); o Dexie persiste
 *  em segundo plano. O estado local nasce do item 1× — re-puxar pula os itens existentes, então não
 *  há resync a fazer. Os selects escrevem direto (não têm cursor). */
function Row({ item }: { item: TaxItem }) {
  const { t } = useTranslation();
  const foreign = isForeignCurrency(item.currency);
  const issues = itemIssues(item);
  const patch = (p: Partial<TaxItem>) => void actions.putTaxItem({ ...item, ...p });
  const [disc, setDisc] = useState(item.discriminacao);
  const [val, setVal] = useState(item.valorAnoBase ? String(item.valorAnoBase) : "");
  const [brl, setBrl] = useState(item.valorBrlAnoBase != null ? String(item.valorBrlAnoBase) : "");

  const codeOptions = item.kind === "debt"
    ? DIVIDAS_CODES
    : (BENS_GROUPS.find((g) => g.group === item.group)?.codes ?? []);

  return (
    <div className="px-4 sm:px-5 py-4 space-y-3">
      {/* Linha 1: código (grupo + código) + moeda/país + remover */}
      <div className="flex flex-wrap items-center gap-2">
        {item.kind === "asset" ? (
          <select
            value={item.group}
            onChange={(e) => patch({ group: e.target.value, code: "" })}
            className="h-8 rounded-[8px] border border-border bg-card2 px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label={t("irpf.group")}
          >
            <option value="">{t("irpf.group")}…</option>
            {BENS_GROUPS.map((g) => <option key={g.group} value={g.group}>{g.group} · {g.name}</option>)}
          </select>
        ) : null}
        <select
          value={item.code}
          onChange={(e) => patch({ code: e.target.value })}
          className="h-8 min-w-0 max-w-[280px] rounded-[8px] border border-border bg-card2 px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label={t("irpf.code")}
        >
          <option value="">{t("irpf.code")}…</option>
          {codeOptions.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
        </select>
        <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] bg-card2 text-[11px] font-mono uppercase tracking-[0.06em] text-muted">
          {foreign ? <Globe size={12} className="text-eur" /> : null}{item.currency}
        </span>
        <button
          type="button"
          onClick={() => void actions.removeTaxItem(item.id)}
          className="ml-auto grid place-items-center w-8 h-8 rounded-[8px] text-faint hover:text-neg hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label={t("irpf.removeItem")}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Discriminação */}
      <textarea
        value={disc}
        onChange={(e) => { setDisc(e.target.value); patch({ discriminacao: e.target.value, discriminacaoLocked: true }); }}
        rows={2}
        placeholder={t("irpf.discriminacaoPh")}
        className="w-full rounded-[8px] border border-border bg-card2 px-3 py-2 text-[12.5px] text-text leading-snug resize-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      />

      {/* Valor de 31/12 (na moeda do item) + âmbar "revisar"; exterior → BRL manual + aviso */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="text-[11px] text-faint">
          <span className="block mb-1">{t("irpf.valueOn", { year: item.baseYear })} ({item.currency})</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={val}
              onChange={(e) => { setVal(e.target.value); patch({ valorAnoBase: Number(e.target.value), needsReview: false }); }}
              className={cn(
                "h-9 w-40 rounded-[8px] border bg-card2 px-3 text-[13px] text-text tabular text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                item.needsReview ? "border-[color-mix(in_oklab,#e0a33c_55%,transparent)]" : "border-border",
              )}
            />
            {item.needsReview ? (
              <span className="text-[10.5px] font-medium text-[#e0a33c] whitespace-nowrap">{t("irpf.review")}</span>
            ) : null}
          </div>
        </label>

        {foreign ? (
          <label className="text-[11px] text-faint">
            <span className="block mb-1">{t("irpf.valueBrl")}</span>
            <input
              type="number"
              inputMode="decimal"
              value={brl}
              placeholder="R$ —"
              onChange={(e) => { setBrl(e.target.value); patch({ valorBrlAnoBase: e.target.value === "" ? undefined : Number(e.target.value) }); }}
              className="h-9 w-40 rounded-[8px] border border-border bg-card2 px-3 text-[13px] text-text tabular text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </label>
        ) : null}
      </div>

      {foreign ? (
        <div className="space-y-2">
          <p className="text-[11.5px] text-[#e0a33c] flex items-start gap-1.5">
            <Globe size={13} className="shrink-0 mt-0.5" /> {t("irpf.foreignWarn")}
          </p>
          <PtaxCalc item={item} onPick={(v, note) => { setBrl(String(v)); patch({ valorBrlAnoBase: v, fxNote: note }); }} />
          {item.fxNote ? <p className="text-[10.5px] text-faint">{t("irpf.fxUsed", { note: item.fxNote })}</p> : null}
        </div>
      ) : null}

      {item.kind === "asset" && item.code ? (
        <p className="text-[11px] text-faint">{codeName(item.group, item.code)}</p>
      ) : null}

      {issues.length ? (
        <div className="flex flex-wrap gap-1.5">
          {issues.map((iss) => (
            <span key={iss} className="inline-flex items-center px-2 h-[20px] rounded-full bg-[color-mix(in_oklab,var(--neg)_12%,transparent)] text-neg text-[10.5px] font-medium">
              {t(`irpf.issues.${iss}`)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Calculadora de câmbio ASSISTIDA (só exterior): informe valor + DATA DE AQUISIÇÃO e o app busca o
 *  PTAX oficial do BCB daquela data (trata dia não-útil). Mostra compra E venda — o critério e o método
 *  de valoração ficam com o contador. NUNCA preenche o BRL sozinho. */
function PtaxCalc({ item, onPick }: { item: TaxItem; onPick: (brl: number, note: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(item.valorAnoBase ? String(item.valorAnoBase) : "");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState<{ compra: number; venda: number; date: string } | null>(null);
  const [err, setErr] = useState(false);

  async function calc() {
    if (!date) return;
    setBusy(true); setErr(false); setRate(null);
    try {
      const r = await fetch(`/api/ptax?currency=${encodeURIComponent(item.currency)}&date=${date}`);
      const j = await r.json();
      if (!r.ok || j.error || !(j.compra > 0)) { setErr(true); return; }
      setRate({ compra: j.compra, venda: j.venda, date: j.date });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }
  function pick(kind: "compra" | "venda") {
    if (!rate || !(Number(valor) > 0)) return;
    onPick(Math.round(Number(valor) * rate[kind] * 100) / 100, `PTAX ${kind} ${rate.date}`);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-accent hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded">
        {t("irpf.ptaxOpen")}
      </button>
    );
  }
  return (
    <div className="rounded-[10px] border border-border bg-card2/50 p-3 space-y-2.5">
      <p className="text-[10.5px] text-faint">{t("irpf.ptaxHint")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] text-faint">
          <span className="block mb-1">{t("irpf.ptaxValue", { cur: item.currency })}</span>
          <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="h-8 w-32 rounded-[7px] border border-border bg-card px-2 text-[12px] tabular text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
        </label>
        <label className="text-[10px] text-faint">
          <span className="block mb-1">{t("irpf.ptaxDate")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 rounded-[7px] border border-border bg-card px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
        </label>
        <button type="button" onClick={calc} disabled={busy || !date} className="h-8 px-3 rounded-[7px] bg-accent text-[#08130C] text-[11.5px] font-semibold disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          {busy ? "…" : t("irpf.ptaxCalc")}
        </button>
      </div>
      {err ? <p className="text-[11px] text-neg">{t("irpf.ptaxError")}</p> : null}
      {rate ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-faint">PTAX {rate.date}:</span>
            <button type="button" onClick={() => pick("compra")} className="px-2.5 h-7 rounded-full border border-border hover:border-accent hover:text-accent text-text tabular transition-colors">{t("irpf.ptaxCompra")} {rate.compra.toFixed(4)}</button>
            <button type="button" onClick={() => pick("venda")} className="px-2.5 h-7 rounded-full border border-border hover:border-accent hover:text-accent text-text tabular transition-colors">{t("irpf.ptaxVenda")} {rate.venda.toFixed(4)}</button>
          </div>
          <p className="text-[10.5px] text-[#e0a33c]">{t("irpf.ptaxConfirm")}</p>
        </div>
      ) : null}
    </div>
  );
}
