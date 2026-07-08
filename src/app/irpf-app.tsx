import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Plus, Trash2, Download, RefreshCw, ShieldCheck, Globe } from "lucide-react";
import { useIsPro } from "@/hooks/use-pro";
import { useProStore } from "@/store/pro";
import { useTaxItems, useTaxReturns } from "@/hooks/use-irpf";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";
import { buildSeedTaxItems } from "@/finance/irpf-seed";
import { irpfSeedMapper } from "@/irpf/mapper";
import { BENS_GROUPS, DIVIDAS_CODES, groupName, codeName, isForeignCurrency, CODES_LAYOUT } from "@/irpf/codes";
import type { TaxItem } from "@/domain/irpf";
import { cn } from "@/lib/utils";

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1000px] mx-auto";
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
          <Organizer year={year} items={items} />
        )}
      </div>
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
function Organizer({ year, items }: { year: number; items: TaxItem[] | null }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function pull() {
    setBusy(true);
    try {
      if (!(await repository.getTaxReturn(String(year)))) {
        await actions.putTaxReturn({ id: String(year), baseYear: year, reportingCurrency: "BRL", status: "draft", updatedAt: Date.now() });
      }
      const [assets, liabilities, existing] = await Promise.all([
        repository.listAssets(),
        repository.listLiabilities(),
        repository.listTaxItems(year),
      ]);
      const fresh = buildSeedTaxItems(year, assets, liabilities, existing, irpfSeedMapper);
      if (fresh.length) await actions.putTaxItems(fresh);
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    if (!(await repository.getTaxReturn(String(year)))) {
      await actions.putTaxReturn({ id: String(year), baseYear: year, reportingCurrency: "BRL", status: "draft", updatedAt: Date.now() });
    }
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

  const bens = (items ?? []).filter((i) => i.kind === "asset");
  const dividas = (items ?? []).filter((i) => i.kind === "debt");
  const bensByGroup = useMemo(() => {
    const m = new Map<string, TaxItem[]>();
    for (const it of bens) (m.get(it.group) ?? m.set(it.group, []).get(it.group)!).push(it);
    return [...m.entries()].sort((a, b) => (a[0] || "zz").localeCompare(b[0] || "zz"));
  }, [bens]);
  const empty = (items ?? []).length === 0;

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
        <span className="ml-auto inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border border-dashed border-border text-[12.5px] text-faint" title={t("irpf.exportSoon")}>
          <Download size={15} /> {t("irpf.exportSoon")}
        </span>
      </div>

      {empty ? (
        <div className="rounded-[16px] border border-dashed border-border p-8 text-center text-[13.5px] text-muted">
          {t("irpf.emptyState")}
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
        <p className="text-[11.5px] text-[#e0a33c] flex items-start gap-1.5">
          <Globe size={13} className="shrink-0 mt-0.5" /> {t("irpf.foreignWarn")}
        </p>
      ) : null}

      {item.kind === "asset" && item.code ? (
        <p className="text-[11px] text-faint">{codeName(item.group, item.code)}</p>
      ) : null}
    </div>
  );
}
