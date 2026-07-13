import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Plus, Trash2, Download, RefreshCw, ShieldCheck, Globe, AlertTriangle, CalendarClock, Table, FileDown, Upload, Tag, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Check } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useIsPro } from "@/hooks/use-pro";
import { useProStore } from "@/store/pro";
import { useTaxItems, useTaxReturns } from "@/hooks/use-irpf";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";
import { buildSeedTaxItems, buildRollForward, refreshPulledValues } from "@/finance/irpf-seed";
import { explodeHoldings, supersededByHoldings } from "@/finance/holdings";
import { irpfSeedMapper, composeDiscriminacao, fieldsFor, findUnmarkedDisposals, DISPOSAL_FIELDS } from "@/irpf/mapper";
import { itemIssues, countPending, diffPatrimonio } from "@/irpf/validate";
import { summarizeIncome, currentIncomeMonth } from "@/irpf/income";
import { buildBensCSV, buildDividasCSV, downloadCSV, parseIrpfImport, IRPF_IMPORT_TEMPLATE } from "@/irpf/irpf-csv";
import { IrpfReport } from "@/irpf/irpf-report";
import { belongsTo, applyShare, incomesForDeclarante } from "@/irpf/declarante";
import { BENS_GROUPS, DIVIDAS_CODES, groupName, codeName, isForeignCurrency, CODES_LAYOUT, defaultBaseYear, yearCloseWindow } from "@/irpf/codes";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useSettings } from "@/hooks/use-settings";
import { nameById, type TaxonomyItem } from "@/domain/taxonomy";
import { Money } from "@/components/common/money";
import { maskAmountInput, formatAmountEdit } from "@/money/parse";
import type { TaxItem, TaxReturn } from "@/domain/irpf";
import { SHARED_OWNER } from "@/domain/irpf";
import { cn } from "@/lib/utils";

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto"; // mesma largura/estrutura das outras páginas
// Cabeçalho de seção/card — mono, mas LEGÍVEL (texto forte + semibold), não o eyebrow apagado.
const HEAD = "font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-text";
const currentYear = new Date().getFullYear();

/** Tela cheia do Organizador de IRPF — renderizada na casca (menu presente), igual a Config/Suporte. */
export function IrpfView() {
  const { t } = useTranslation();
  const { isPro, resolved } = useIsPro();
  const openPaywall = useProStore((s) => s.openPaywall);
  const returns = useTaxReturns();

  const latest = returns && returns.length ? Math.max(...returns.map((r) => r.baseYear)) : null;
  const [selYear, setSelYear] = useState<number | null>(null);
  // Padrão = o ano que você está PREPARANDO (não um já declarado). Nunca abaixo disso, mesmo que
  // exista um ano anterior salvo — evita cair num ano retroativo já entregue.
  const year = selYear ?? Math.max(defaultBaseYear(), latest ?? 0);
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
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const allAssets = useLiveQuery(() => repository.listAllAssets()) ?? [];
  const liabilities = useLiveQuery(() => repository.listLiabilities()) ?? [];
  const list = useMemo(() => items ?? [], [items]);

  // Declaração SEPARADA (casal): só quando escolhida E há 2+ pessoas. "Eu" (primário) = a 1ª pessoa,
  // salvo o que o usuário definir. O declarante em foco filtra o que aparece e o que exporta.
  const tax = useTaxonomy();
  const settings = useSettings();
  const people = tax.people;
  const separate = settings.irpf?.mode === "separate" && people.length >= 2;
  const primaryId = (separate && settings.irpf?.primaryId && people.some((p) => p.id === settings.irpf!.primaryId) ? settings.irpf!.primaryId : people[0]?.id) ?? "";
  const [selDeclarante, setSelDeclarante] = useState<string | null>(null);
  const [showPrimary, setShowPrimary] = useState(false);
  const declarante = separate ? (selDeclarante && people.some((p) => p.id === selDeclarante) ? selDeclarante : primaryId) : "";
  // Lista MOSTRADA: no separado, só os bens do declarante (+ comuns); no conjunto, tudo.
  const visible = useMemo(() => (separate ? list.filter((i) => belongsTo(i, declarante, primaryId)) : list), [list, separate, declarante, primaryId]);
  // Itens prontos p/ exportar: sem os "não declarar"; no separado, filtrados e comuns já divididos.
  const forExport = useMemo(() => (separate ? visible.map(applyShare) : list).filter((i) => !i.excluded), [visible, list, separate]);
  const declaranteName = separate ? nameById(people, declarante) : "";

  // Bens vendidos ANTES do ano-base já saíram (não entram). Vendidos no ano-base ou depois ainda
  // interessam (no ano ⇒ ficha com base 0; depois ⇒ ainda eram seus em 31/12 ⇒ bem normal).
  const allExploded = useMemo(() => explodeHoldings(allAssets), [allAssets]);
  const relevantAssets = useMemo(
    () => allExploded.filter((a) => !a.disposedOn || Number(a.disposedOn.slice(0, 4)) >= year),
    [allExploded, year],
  );
  // Itens tornados obsoletos pela discriminação (o agregado "Ações" depois de virar posições, etc.) —
  // limpeza de sync: some sozinho ao carregar/puxar (não vira órfão nem "erro" de incompleto).
  const supersededIds = useMemo(() => new Set(supersededByHoldings(list, allExploded)), [list, allExploded]);
  useEffect(() => {
    if (supersededIds.size) for (const id of supersededIds) void actions.removeTaxItem(id);
  }, [supersededIds]);
  const diff = useMemo(() => diffPatrimonio(list, relevantAssets, liabilities), [list, relevantAssets, liabilities]);
  const orphans = useMemo(() => diff.orphans.filter((o) => !supersededIds.has(o.id)), [diff.orphans, supersededIds]);
  // Bens já na lista cujo bem de origem foi vendido este ano mas ainda não estão marcados (roll-forward).
  const unmarkedDisposals = useMemo(() => findUnmarkedDisposals(list, relevantAssets, year), [list, relevantAssets, year]);
  // Itens marcados "não declarar" (excluded) saem das contas de pendência/conferir/atenção.
  const declaredVisible = useMemo(() => visible.filter((i) => !i.excluded), [visible]);
  const pending = countPending(declaredVisible);
  const newCount = diff.newAssets.length + diff.newLiabilities.length;
  const needsReviewCount = declaredVisible.filter((i) => i.needsReview).length;
  const thisReturn = useMemo(() => (returns ?? []).find((r) => r.baseYear === year), [returns, year]);
  const closedAt = thisReturn?.closedAt;
  // Estamos na janela de fechar a posição de 31/12 deste ano e ele ainda não foi fechado?
  const showCloseReminder = yearCloseWindow() === year && !closedAt;
  const priorYear = useMemo(() => {
    const ys = (returns ?? []).map((r) => r.baseYear).filter((y) => y < year);
    return ys.length ? Math.max(...ys) : null;
  }, [returns, year]);
  const incomes = useLiveQuery(() => repository.listIncomes()) ?? [];
  const incSource = useMemo(() => (separate ? incomesForDeclarante(incomes, declarante, primaryId) : incomes), [incomes, separate, declarante, primaryId]);
  // Teto no mês atual: o resumo NÃO conta renda de meses futuros (ano em andamento) — não infla o IR.
  const incomeSummary = useMemo(() => summarizeIncome(incSource, year, currentIncomeMonth()), [incSource, year]);

  async function ensureReturn() {
    if (!(await repository.getTaxReturn(String(year)))) {
      await actions.putTaxReturn({ id: String(year), baseYear: year, reportingCurrency: "BRL", status: "draft", updatedAt: Date.now() });
    }
  }

  /** Sincroniza os itens a partir do patrimônio: novos bens + vendas do ano (base 0). Não mexe no busy. */
  async function syncFromPatrimonio() {
    const [curAssets, curLiabs, existing] = await Promise.all([
      repository.listAllAssets(),
      repository.listLiabilities(),
      repository.listTaxItems(year),
    ]);
    const relevant = explodeHoldings(curAssets).filter((a) => !a.disposedOn || Number(a.disposedOn.slice(0, 4)) >= year);
    const fresh = buildSeedTaxItems(year, relevant, curLiabs, existing, irpfSeedMapper);
    // Bens que já estavam na lista e foram vendidos este ano → aplica o tratamento de venda.
    const disposals = findUnmarkedDisposals(existing, relevant, year);
    // Atualiza o valor dos itens auto ainda não confirmados pro valor atual (refresh em dezembro).
    const refreshed = refreshPulledValues(existing, relevant, year, irpfSeedMapper);
    const toWrite = [...fresh, ...disposals, ...refreshed];
    if (toWrite.length) await actions.putTaxItems(toWrite);
  }

  async function pull() {
    setBusy(true);
    try {
      await ensureReturn();
      await syncFromPatrimonio();
    } finally {
      setBusy(false);
    }
  }

  /** Fechar o ano: congela a posição de 31/12 (puxa do patrimônio) e carimba o ano como fechado. */
  async function closeYear() {
    setBusy(true);
    try {
      await ensureReturn();
      await syncFromPatrimonio();
      const tr = await repository.getTaxReturn(String(year));
      if (tr) await actions.putTaxReturn({ ...tr, closedAt: Date.now(), updatedAt: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  /** Registra as vendas dos bens que já estavam na lista (um clique) — base 0 + história da venda. */
  async function markDisposals() {
    if (unmarkedDisposals.length) await actions.putTaxItems(unmarkedDisposals);
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

  /** Puxei tudo no fim do ano e conferi → limpa os "revisar" de uma vez (um clique). */
  async function confirmAll() {
    const cleared = visible.filter((i) => i.needsReview).map((i) => ({ ...i, needsReview: false }));
    if (cleared.length) await actions.putTaxItems(cleared);
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
      createdAt: Date.now(),
      ...(separate ? { ownerId: declarante } : {}),
    });
  }

  /** Bem comprado E vendido no mesmo ano (nunca tocou um 31/12): as duas colunas ficam 0, a operação
   *  inteira vai na discriminação. O app não vê isso pelos saldos → registro manual. */
  async function addSold() {
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
      valorAnoAnterior: 0,
      disposed: true,
      fields: { dataVenda: "", valorVenda: "", comprador: "" },
      source: "manual",
      createdAt: Date.now(),
      ...(separate ? { ownerId: declarante } : {}),
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
    const tag = separate && declaranteName ? `-${declaranteName.toLowerCase().replace(/\s+/g, "-")}` : "";
    downloadCSV(`irpf-${year}${tag}-bens-e-direitos.csv`, buildBensCSV(forExport));
    if (forExport.some((i) => i.kind === "debt")) downloadCSV(`irpf-${year}${tag}-dividas.csv`, buildDividasCSV(forExport));
  }

  const fileRef = useRef<HTMLInputElement>(null);
  function downloadTemplate() {
    downloadCSV(`irpf-${year}-modelo.csv`, IRPF_IMPORT_TEMPLATE);
  }
  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar o mesmo arquivo
    if (!file) return;
    await ensureReturn();
    const imported = parseIrpfImport(await file.text(), year);
    if (imported.length) await actions.putTaxItems(imported);
  }

  const bens = visible.filter((i) => i.kind === "asset");
  const dividas = visible.filter((i) => i.kind === "debt");
  const bensByGroup = useMemo(() => {
    const m = new Map<string, TaxItem[]>();
    for (const it of bens) (m.get(it.group) ?? m.set(it.group, []).get(it.group)!).push(it);
    // Grupo VAZIO (sem código — item recém-criado) PRIMEIRO; dentro dele, o mais novo no topo.
    m.get("")?.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return [...m.entries()].sort((a, b) => (a[0] || "00").localeCompare(b[0] || "00"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const empty = list.length === 0;

  // Accordions: cada card (grupo de bens · dívidas · rendimentos) abre/fecha. Padrão = TUDO FECHADO
  // (rastreia os ABERTOS; grupos novos nascem fechados). Estado por SESSÃO (some ao sair da página).
  // Fechado, o cabeçalho ainda avisa se há pendência (bolinha âmbar) — não some problema ao esconder.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const groupKeys = useMemo(() => [
    ...bensByGroup.map(([g]) => g || "sem"),
    ...(dividas.length ? ["dividas"] : []),
    ...(incomeSummary.length ? ["rendimentos"] : []),
  ], [bensByGroup, dividas.length, incomeSummary.length]);
  const isOpen = (k: string) => opened.has(k);
  const toggle = (k: string) => setOpened((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const anyOpen = groupKeys.some((k) => opened.has(k));
  const toggleAll = () => setOpened(anyOpen ? new Set() : new Set(groupKeys));
  const hasAttention = (items: TaxItem[]) => items.some((it) => !it.excluded && (itemIssues(it).length > 0 || it.needsReview));

  /** Leva até um item: abre o accordion do grupo dele e rola a linha à vista, com um flash rápido. */
  function revealItem(it: TaxItem) {
    const key = it.kind === "debt" ? "dividas" : it.group || "sem";
    setOpened((s) => new Set(s).add(key));
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-irpf-item="${CSS.escape(it.id)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("irpf-flash");
      window.setTimeout(() => el.classList.remove("irpf-flash"), 1500);
    }, 70);
  }
  const orphanLabel = (it: TaxItem): string =>
    it.fields?.nome?.trim() ||
    (it.kind === "debt" ? codeName("", it.code, "debt") : codeName(it.group, it.code)) ||
    it.discriminacao?.split(" — ")[0]?.slice(0, 28) ||
    t("irpf.removeItem");

  function setMode(mode: "joint" | "separate") {
    void actions.putSettings({ irpf: { ...settings.irpf, mode, primaryId: settings.irpf?.primaryId || people[0]?.id } });
  }
  function setPrimary(id: string) {
    void actions.putSettings({ irpf: { ...settings.irpf, mode: "separate", primaryId: id } });
  }

  return (
    <div className="space-y-4">
      {/* Aviso de honestidade — permanente, mas COMPACTO (nota discreta de 1 linha, não uma barra). */}
      <div className="flex items-center gap-2 px-1 text-[11.5px] text-faint">
        <ShieldCheck size={14} className="text-accent shrink-0" />
        <span>{t("irpf.disclaimer")}</span>
      </div>

      {/* Modalidade da declaração (só aparece com 2+ pessoas na casa): conjunta × separada + declarante */}
      {people.length >= 2 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[12px] border border-border bg-card2/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-muted">{t("irpf.filingMode")}</span>
            <div className="inline-flex rounded-[9px] bg-card p-0.5 border border-border">
              {(["joint", "separate"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={(settings.irpf?.mode ?? "joint") === m}
                  className={cn(
                    "px-3 h-7 rounded-[7px] text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    (settings.irpf?.mode ?? "joint") === m ? "bg-accent text-[#08130C]" : "text-muted hover:text-text",
                  )}
                >
                  {t(m === "joint" ? "irpf.modeJoint" : "irpf.modeSeparate")}
                </button>
              ))}
            </div>
          </div>
          {separate ? (
            <>
              {/* UM seletor: de quem é a declaração em foco. O titular ("você") fica marcado (você). */}
              <label className="flex items-center gap-2 text-[12px] text-muted">
                {t("irpf.declarante")}
                <select
                  value={declarante}
                  onChange={(e) => setSelDeclarante(e.target.value)}
                  className="h-8 rounded-[8px] border border-border bg-card px-2.5 text-[12.5px] font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === primaryId ? ` (${t("irpf.you")})` : ""}</option>)}
                </select>
              </label>
              {/* "Quem é você?" — troca o titular (default dos bens sem dono); escondido até clicar. */}
              {showPrimary ? (
                <label className="flex items-center gap-2 text-[11.5px] text-faint">
                  {t("irpf.primaryQ")}
                  <select
                    value={primaryId}
                    onChange={(e) => { setPrimary(e.target.value); setShowPrimary(false); }}
                    className="h-8 rounded-[8px] border border-border bg-card px-2.5 text-[12.5px] text-muted outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              ) : (
                <button type="button" onClick={() => setShowPrimary(true)} className="text-[11.5px] text-faint hover:text-text underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded">
                  {t("irpf.changePrimary")}
                </button>
              )}
              <span className="text-[11.5px] text-faint w-full">{t("irpf.separateHint", { you: nameById(people, primaryId) })}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Fechar o ano: lembrete na janela (dez–mar) + selo quando fechado */}
      {showCloseReminder ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-[color-mix(in_oklab,var(--accent)_38%,transparent)] bg-accent-soft px-4 py-2.5 text-[12.5px] text-muted">
          <CalendarClock size={15} className="text-accent shrink-0" />
          <span className="flex-1 min-w-[240px]">{t("irpf.closeReminder", { year })}</span>
          <button
            type="button"
            onClick={closeYear}
            disabled={busy}
            className="shrink-0 h-8 px-3 rounded-[8px] bg-accent text-[#08130C] text-[12px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {t("irpf.closeYear")}
          </button>
        </div>
      ) : null}
      {closedAt ? (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-border bg-card2/50 px-4 py-2.5 text-[12.5px] text-muted">
          <ShieldCheck size={15} className="text-accent shrink-0" />
          <span>{t("irpf.closedSeal", { year, date: new Date(closedAt).toLocaleDateString(i18n.language === "en" ? "en-US" : "pt-BR") })}</span>
        </div>
      ) : null}

      {/* Ações — agrupadas em menus pra não virar uma parede de botões (nada escondido, só organizado) */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={pull}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-accent text-[#08130C] text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {t("irpf.pull")}
        </button>
        <Menu
          label={t("irpf.addMenu")}
          icon={<Plus size={15} />}
          items={[
            { label: t("irpf.addItem"), icon: <Plus size={14} />, onClick: () => void addManual() },
            { label: t("irpf.addSold"), icon: <Tag size={14} />, onClick: () => void addSold() },
          ]}
        />
        <Menu
          label={t("irpf.importMenu")}
          icon={<Upload size={15} />}
          items={[
            { label: t("irpf.importCsv"), icon: <Upload size={14} />, onClick: () => fileRef.current?.click() },
            { label: t("irpf.importTemplate"), icon: <FileDown size={14} />, onClick: downloadTemplate },
          ]}
        />
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onImport(e)} />
        {!empty ? (
          <div className="ml-auto">
            <Menu
              align="right"
              accent
              label={t("irpf.exportMenu")}
              icon={<Download size={15} />}
              items={[
                { label: t("irpf.docPdf"), icon: <Download size={14} />, onClick: printIRPF },
                { label: t("irpf.docCsv"), icon: <Table size={14} />, onClick: downloadCsvs },
              ]}
            />
          </div>
        ) : null}
      </div>

      {unmarkedDisposals.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-[color-mix(in_oklab,#e0a33c_35%,transparent)] bg-[color-mix(in_oklab,#e0a33c_8%,transparent)] px-4 py-2.5 text-[12.5px] text-muted">
          <Tag size={15} className="text-[#e0a33c] shrink-0" />
          <span className="flex-1 min-w-[240px]">{t("irpf.disposalBanner", { n: unmarkedDisposals.length })}</span>
          <button
            type="button"
            onClick={markDisposals}
            className="shrink-0 h-8 px-3 rounded-[8px] border border-[color-mix(in_oklab,#e0a33c_45%,transparent)] bg-card text-[12px] font-medium text-text hover:border-[#e0a33c] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {t("irpf.disposalMark")}
          </button>
        </div>
      ) : null}
      {needsReviewCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-[color-mix(in_oklab,#e0a33c_35%,transparent)] bg-[color-mix(in_oklab,#e0a33c_8%,transparent)] px-4 py-2.5 text-[12.5px] text-muted">
          <AlertTriangle size={15} className="text-[#e0a33c] shrink-0" />
          <span className="flex-1 min-w-[240px]">{t("irpf.reviewBanner", { n: needsReviewCount, year })}</span>
          <button
            type="button"
            onClick={confirmAll}
            className="shrink-0 h-8 px-3 rounded-[8px] border border-[color-mix(in_oklab,#e0a33c_45%,transparent)] bg-card text-[12px] font-medium text-text hover:border-[#e0a33c] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {t("irpf.reviewClearAll")}
          </button>
        </div>
      ) : null}
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
      {orphans.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[12px] border border-border bg-card2/50 px-4 py-2.5 text-[12.5px] text-muted">
          <CalendarClock size={15} className="text-faint shrink-0" />
          <span className="min-w-0">{t("irpf.orphanBanner", { n: orphans.length })}</span>
          {orphans.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => revealItem(o)}
              className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-[7px] border border-border bg-card text-[11.5px] text-text hover:border-border-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="truncate max-w-[180px]">{orphanLabel(o)}</span>
              <ChevronRight size={12} className="text-faint shrink-0" />
            </button>
          ))}
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
          {/* Recolher/expandir tudo */}
          {groupKeys.length > 1 ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {anyOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
                {anyOpen ? t("irpf.collapseAll") : t("irpf.expandAll")}
              </button>
            </div>
          ) : null}

          {bensByGroup.map(([group, glist]) => {
            const key = group || "sem";
            return (
              <CollapsibleCard
                key={key}
                open={isOpen(key)}
                onToggle={() => toggle(key)}
                title={group ? `${group} · ${groupName(group)}` : t("irpf.noCode")}
                count={glist.length}
                attention={hasAttention(glist)}
              >
                <div className="divide-y divide-border">
                  {glist.map((it) => <Row key={it.id} item={it} owner={separate ? { people, primaryId } : undefined} />)}
                </div>
              </CollapsibleCard>
            );
          })}

          {dividas.length ? (
            <CollapsibleCard
              open={isOpen("dividas")}
              onToggle={() => toggle("dividas")}
              title={t("irpf.debtsSection")}
              count={dividas.length}
              attention={hasAttention(dividas)}
            >
              <div className="divide-y divide-border">
                {dividas.map((it) => <Row key={it.id} item={it} owner={separate ? { people, primaryId } : undefined} />)}
              </div>
            </CollapsibleCard>
          ) : null}
        </>
      )}

      {incomeSummary.length ? (
        <CollapsibleCard
          open={isOpen("rendimentos")}
          onToggle={() => toggle("rendimentos")}
          title={separate ? `${t("irpf.incomeSection", { year })} · ${declaranteName}` : t("irpf.incomeSection", { year })}
        >
          <div className="px-4 sm:px-5 py-3.5 space-y-2">
            <p className="text-[11.5px] text-faint">{t("irpf.incomeHint")}</p>
            {incomeSummary.map((r) => (
              <div key={r.categoryId + r.currency} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-muted truncate">{nameById(tax.incomeCategories, r.categoryId) || t("irpf.incomeUncat")}</span>
                <Money value={r.total} currency={r.currency} className="tabular font-medium shrink-0" />
              </div>
            ))}
          </div>
        </CollapsibleCard>
      ) : null}

      {/* Documento impresso (oculto) — no separado, o do declarante em foco (itens + renda + nome). */}
      <IrpfReport year={year} itemsOverride={separate ? forExport : undefined} incomesOverride={separate ? incSource : undefined} declaranteName={declaranteName} />
    </div>
  );
}

/** Card recolhível (accordion) do organizador — cabeçalho clicável + corpo escondível. Recolhido,
 *  ainda mostra a contagem e um ponto ÂMBAR quando o grupo tem item pendente/a conferir (não some
 *  problema ao esconder o card). */
function CollapsibleCard({ open, onToggle, title, count, attention, children }: {
  open: boolean;
  onToggle: () => void;
  title: string;
  count?: number;
  attention?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-[16px] border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-2.5 px-4 sm:px-5 py-3 text-left transition-colors hover:bg-card-hover outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          open && "border-b border-border",
        )}
      >
        <ChevronDown size={15} className={cn("text-muted transition-transform shrink-0", !open && "-rotate-90")} />
        <span className={cn(HEAD, "flex-1 min-w-0 truncate")}>{title}</span>
        {attention ? <span title={t("irpf.groupAttention")} className="w-2 h-2 rounded-full bg-[#e0a33c] shrink-0" aria-label={t("irpf.groupAttention")} /> : null}
        {count != null ? <span className="eyebrow shrink-0">{count} {t(count === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}</span> : null}
      </button>
      {open ? children : null}
    </section>
  );
}

/** Botão com menu suspenso — agrupa ações afins (Adicionar / Importar / Exportar) sem virar parede
 *  de botões. Fecha ao clicar fora ou escolher. Variante `accent` p/ o de exportar (a saída). */
function Menu({ label, icon, items, align = "left", accent = false }: {
  label: string;
  icon: ReactNode;
  items: { label: string; icon?: ReactNode; onClick: () => void }[];
  align?: "left" | "right";
  accent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          accent
            ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-soft text-accent hover:border-accent"
            : "border-border bg-card text-text hover:border-border-strong",
        )}
      >
        {icon} {label} <ChevronDown size={14} className={accent ? "text-accent" : "text-faint"} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn("absolute mt-1.5 z-50 min-w-[210px] rounded-[12px] border border-border bg-card shadow-[var(--shadow-float)] p-1.5", align === "right" ? "right-0" : "left-0")}>
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setOpen(false); it.onClick(); }}
                className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-[8px] text-left text-[13px] text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {it.icon ? <span className="text-faint shrink-0">{it.icon}</span> : null}
                {it.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Input de dinheiro com MÁSCARA "centavos" (pt-BR): digita só números e a pontuação + as 2 casas
 *  decimais entram sozinhas ("123456" → "1.234,56"). Resync quando o valor muda por fora (ex.: PTAX). */
function MoneyField({ value, amber, onChange }: { value: number | undefined; amber?: boolean; onChange: (n: number | undefined) => void }) {
  const fmt = (n?: number) => (n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const [raw, setRaw] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setRaw(fmt(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      placeholder="R$ —"
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; setRaw(fmt(value)); }}
      onChange={(e) => {
        const el = e.currentTarget;
        const { display, value: v } = maskAmountInput(el.value, "BRL");
        setRaw(display);
        onChange(v);
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }}
      className={cn(
        "h-9 w-40 rounded-[8px] border bg-card2 px-3 text-[13px] text-text tabular text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        amber ? "border-[color-mix(in_oklab,#e0a33c_55%,transparent)]" : "border-border",
      )}
    />
  );
}

/** Uma linha de bem/dívida — grupo/código, CAMPOS estruturados (que geram a discriminação), valores.
 *  Campos e discriminação em estado local (sem pulo de cursor); mudar um campo regenera a discriminação
 *  (a menos que o usuário a tenha editado à mão → discriminacaoLocked). O Dexie persiste ao fundo. */
function Row({ item, owner }: { item: TaxItem; owner?: { people: TaxonomyItem[]; primaryId: string } }) {
  const { t } = useTranslation();
  const foreign = isForeignCurrency(item.currency);
  const issues = itemIssues(item);
  const patch = (p: Partial<TaxItem>) => void actions.putTaxItem({ ...item, ...p });
  // Dono (só declaração separada): a pessoa, ou "Comum" (dividido). Vazio/ausente = declarante primário.
  const ownerValue = item.ownerId ?? (owner ? owner.primaryId : "");
  function setOwner(v: string) {
    if (v === SHARED_OWNER) patch({ ownerId: SHARED_OWNER, sharePct: item.sharePct ?? 50 });
    else patch({ ownerId: v, sharePct: undefined });
  }
  const [fields, setFields] = useState<Record<string, string>>(item.fields);
  const [disc, setDisc] = useState(item.discriminacao);
  // Bem vendido ganha campos extra da alienação (data/valor/comprador) que entram na discriminação.
  const schema = item.disposed ? [...fieldsFor(item.kind, item.group), ...DISPOSAL_FIELDS] : fieldsFor(item.kind, item.group);

  /** Recompõe a discriminação a partir dos campos, exceto se o usuário travou editando à mão. */
  const regen = (f: Record<string, string>, group = item.group) =>
    item.discriminacaoLocked ? null : composeDiscriminacao(item.kind, group, f);

  function setField(key: string, value: string) {
    const nf = { ...fields, [key]: value };
    setFields(nf);
    const nd = regen(nf);
    if (nd != null) setDisc(nd);
    patch(nd != null ? { fields: nf, discriminacao: nd } : { fields: nf });
  }
  function changeGroup(group: string) {
    const nd = regen(fields, group);
    if (nd != null) setDisc(nd);
    patch(nd != null ? { group, code: "", discriminacao: nd } : { group, code: "" });
  }

  const codeOptions = item.kind === "debt"
    ? DIVIDAS_CODES
    : (BENS_GROUPS.find((g) => g.group === item.group)?.codes ?? []);

  return (
    <div data-irpf-item={item.id} className={cn("px-4 sm:px-5 py-4 space-y-3 transition-opacity", item.excluded && "opacity-45")}>
      {/* Linha 1: [declarar?] grupo + código + moeda/país + remover */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Checkbox "declarar": marcado = vai à declaração; desmarcado = fica na lista mas fora do doc. */}
        <button
          type="button"
          onClick={() => patch({ excluded: !item.excluded })}
          title={item.excluded ? t("irpf.declareOff") : t("irpf.declareOn")}
          aria-label={item.excluded ? t("irpf.declareOff") : t("irpf.declareOn")}
          aria-pressed={!item.excluded}
          className={cn(
            "grid place-items-center w-[22px] h-[22px] rounded-[6px] border shrink-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            item.excluded ? "border-border text-transparent hover:border-border-strong" : "border-accent bg-accent text-[#08130C]",
          )}
        >
          <Check size={14} />
        </button>
        {item.excluded ? (
          <span className="text-[10.5px] font-medium text-faint uppercase tracking-[0.06em] shrink-0">{t("irpf.excludedBadge")}</span>
        ) : null}
        {item.kind === "asset" ? (
          <select
            value={item.group}
            onChange={(e) => changeGroup(e.target.value)}
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
          className="h-8 flex-1 min-w-[200px] max-w-[560px] rounded-[8px] border border-border bg-card2 px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label={t("irpf.code")}
        >
          <option value="">{t("irpf.code")}…</option>
          {codeOptions.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
        </select>
        <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] bg-card2 text-[11px] font-mono uppercase tracking-[0.06em] text-muted">
          {foreign ? <Globe size={12} className="text-eur" /> : null}{item.currency}
        </span>
        {item.disposed ? (
          <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[8px] bg-[color-mix(in_oklab,#e0a33c_14%,transparent)] text-[10.5px] font-mono uppercase tracking-[0.08em] text-[#e0a33c]">
            <Tag size={11} /> {t("irpf.soldBadge")}
          </span>
        ) : null}
        {owner ? (
          <span className="inline-flex items-center gap-1.5">
            <select
              value={ownerValue}
              onChange={(e) => setOwner(e.target.value)}
              className="h-8 rounded-[8px] border border-border bg-card2 px-2 text-[11.5px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={t("irpf.owner")}
              title={t("irpf.owner")}
            >
              {owner.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value={SHARED_OWNER}>{t("irpf.ownerShared")}</option>
            </select>
            {item.ownerId === SHARED_OWNER ? (
              <span className="inline-flex items-center h-8 px-2 rounded-[8px] bg-accent-soft text-[11px] text-accent tabular" title={t("irpf.sharePct")}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={item.sharePct ?? 50}
                  onChange={(e) => patch({ sharePct: Math.max(1, Math.min(100, Number(e.target.value) || 50)) })}
                  className="w-9 bg-transparent text-right tabular outline-none"
                  aria-label={t("irpf.sharePct")}
                />
                %
              </span>
            ) : null}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void actions.removeTaxItem(item.id)}
          className="ml-auto grid place-items-center w-8 h-8 rounded-[8px] text-faint hover:text-neg hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label={t("irpf.removeItem")}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Campos estruturados — geram a discriminação */}
      <div>
        <div className="text-[10px] text-faint mb-1.5">{t("irpf.fieldsHint")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {schema.map((f) => (
            <label key={f.key} className={cn("text-[10px] text-faint", f.wide && "col-span-2 sm:col-span-4")}>
              <span className="block mb-1">{f.label}</span>
              <input
                value={fields[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
                className="w-full h-8 rounded-[7px] border border-border bg-card2 px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Discriminação gerada (o texto que vai ao contador) — editável */}
      <div>
        <div className="text-[10px] text-faint mb-1">{t("irpf.discLabel")}</div>
        <textarea
          value={disc}
          onChange={(e) => { setDisc(e.target.value); patch({ discriminacao: e.target.value, discriminacaoLocked: true }); }}
          rows={2}
          className="w-full rounded-[8px] border border-border bg-card2 px-3 py-2 text-[12.5px] text-text leading-snug resize-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        />
      </div>

      {item.disposed ? (
        /* Bem VENDIDO: coluna do ano-base = 0 (regra); a do ano anterior mantém o custo. */
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <label className="text-[11px] text-faint">
              <span className="block mb-1">{t("irpf.priorValue", { year: item.baseYear - 1 })} ({item.currency})</span>
              <MoneyField value={item.valorAnoAnterior} onChange={(n) => patch({ valorAnoAnterior: n })} />
            </label>
            <div className="text-[11px] text-faint">
              <span className="block mb-1">{t("irpf.valueOn", { year: item.baseYear })}</span>
              <div className="h-9 flex items-center px-1 text-[13px] text-muted tabular">{t("irpf.soldZero")}</div>
            </div>
          </div>
          <p className="text-[11.5px] text-[#e0a33c] flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {t("irpf.capitalGainWarn")}
          </p>
        </div>
      ) : (
        <>
          {/* As duas colunas do IRPF (ano anterior · ano-base), na moeda do item + âmbar "conferir" */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <label className="text-[11px] text-faint">
              <span className="block mb-1">{t("irpf.priorValue", { year: item.baseYear - 1 })} ({item.currency})</span>
              <MoneyField value={item.valorAnoAnterior} onChange={(n) => patch({ valorAnoAnterior: n })} />
            </label>
            <label className="text-[11px] text-faint">
              <span className="block mb-1">{t("irpf.valueOn", { year: item.baseYear })} ({item.currency})</span>
              <div className="flex items-center gap-2">
                <MoneyField value={item.valorAnoBase} amber={item.needsReview} onChange={(n) => patch({ valorAnoBase: n ?? 0, needsReview: false })} />
                {item.needsReview ? (
                  <span title={t("irpf.reviewWhy", { year: item.baseYear })} className="text-[10.5px] font-medium text-[#e0a33c] whitespace-nowrap cursor-help underline decoration-dotted underline-offset-2">{t("irpf.review")}</span>
                ) : null}
              </div>
            </label>
          </div>

          {foreign ? (
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <label className="text-[11px] text-faint">
                <span className="block mb-1">{t("irpf.priorValueBrl", { year: item.baseYear - 1 })}</span>
                <MoneyField value={item.valorBrlAnoAnterior} onChange={(n) => patch({ valorBrlAnoAnterior: n })} />
              </label>
              <label className="text-[11px] text-faint">
                <span className="block mb-1">{t("irpf.valueBrl")}</span>
                <MoneyField value={item.valorBrlAnoBase} onChange={(n) => patch({ valorBrlAnoBase: n })} />
              </label>
            </div>
          ) : null}

          {foreign ? (
            <div className="space-y-2">
              <p className="text-[11.5px] text-[#e0a33c] flex items-start gap-1.5">
                <Globe size={13} className="shrink-0 mt-0.5" /> {t("irpf.foreignWarn")}
              </p>
              <PtaxCalc item={item} onPick={(v, note) => patch({ valorBrlAnoBase: v, fxNote: note })} />
              {item.fxNote ? <p className="text-[10.5px] text-faint">{t("irpf.fxUsed", { note: item.fxNote })}</p> : null}
            </div>
          ) : null}
        </>
      )}

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
  // Display SEMPRE mascarado (máscara "centavos", locale da moeda do item) — o valor numérico
  // sai de maskAmountInput no uso. Antes era Number(string) cru: "500,50" virava NaN em silêncio.
  const [valor, setValor] = useState(item.valorAnoBase ? formatAmountEdit(item.valorAnoBase, item.currency) : "");
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
  const valorNum = maskAmountInput(valor, item.currency).value ?? 0;
  function pick(kind: "compra" | "venda") {
    if (!rate || !(valorNum > 0)) return;
    onPick(Math.round(valorNum * rate[kind] * 100) / 100, `PTAX ${kind} ${rate.date}`);
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
          <input
            inputMode="numeric"
            value={valor}
            onChange={(e) => {
              const el = e.currentTarget;
              setValor(maskAmountInput(el.value, item.currency).display);
              requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
            }}
            className="h-8 w-32 rounded-[7px] border border-border bg-card px-2 text-[12px] tabular text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
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
            <button type="button" onClick={() => pick("compra")} disabled={!(valorNum > 0)} className="px-2.5 h-7 rounded-full border border-border hover:border-accent hover:text-accent text-text tabular transition-colors disabled:opacity-50 disabled:pointer-events-none">{t("irpf.ptaxCompra")} {rate.compra.toFixed(4)}</button>
            <button type="button" onClick={() => pick("venda")} disabled={!(valorNum > 0)} className="px-2.5 h-7 rounded-full border border-border hover:border-accent hover:text-accent text-text tabular transition-colors disabled:opacity-50 disabled:pointer-events-none">{t("irpf.ptaxVenda")} {rate.venda.toFixed(4)}</button>
          </div>
          <p className="text-[10.5px] text-[#e0a33c]">{t("irpf.ptaxConfirm")}</p>
        </div>
      ) : null}
    </div>
  );
}
