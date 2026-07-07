import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Repeat, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyBadge } from "@/components/common/currency-badge";
import { CURRENCIES, type Currency } from "@/money/currency";
import { formatAmountEdit, formatNumberEdit, parseLocaleNumber } from "@/money/parse";
import { useUI } from "@/store/ui";
import { useViewer } from "@/store/viewer";
import { useIsMobile } from "@/hooks/use-media";

const MASK = "••••";

// ── Tipos ───────────────────────────────────────────────────────────────────
export type ColType = "currency" | "text" | "select" | "money" | "number" | "day" | "month" | "computed" | "toggle" | "insideStatement";

const MONTH_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };
/** "AAAA-MM" → "jun/26" no locale dado. */
function monthLabel(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return "";
  const mon = new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "short" }).replace(".", "");
  return `${mon}/${String(y).slice(-2)}`;
}

export type SelectOption = { value: string; label: string };

export interface GridColumn<T> {
  key: string;
  header: string;
  type: ColType;
  width: string; // trilha do CSS grid
  align?: "left" | "right";
  options?: SelectOption[];
  /** select em CASCATA: opções dependem da linha (ex.: Subtipo depende da Classe). */
  optionsFor?: (row: T) => SelectOption[];
  /** select AGRUPADO: opções em seções (optgroup) — tem precedência sobre options/optionsFor. */
  optionGroups?: { label: string; options: SelectOption[] }[];
  /** Ao mudar ESTA célula, DERIVA outros campos junto (ex.: escolher o país preenche a moeda). */
  derive?: (value: string, row: T) => Partial<T>;
  /** select opcional: inclui um "—" (vazio) e o valor pode ficar em branco. */
  optional?: boolean;
  currencyKey?: string; // money/number: campo da moeda p/ o locale (default "currency")
  /** money: NÃO mostrar o seletor de moeda embutido (quando a moeda tem coluna própria). */
  hideCurrency?: boolean;
  /** number: casas decimais FIXAS (ex.: preço médio = 2). Indefinido = flexível (qtd). */
  decimals?: number;
  /** month: maior mês selecionável ("AAAA-MM"). Meses depois disso ficam desabilitados
   *  (ex.: histórico de patrimônio é só passado/presente — mês futuro não faz sentido). */
  maxMonth?: string;
  placeholder?: string;
  compute?: (row: T) => ReactNode;
  /** toggle: ícone (default Repeat) — pra distinguir toggles diferentes (ex.: recorrente vs fatura). */
  icon?: LucideIcon;
  /** toggle: estado LIGADO derivado (default = o campo booleano da coluna). */
  isOn?: (row: T) => boolean;
  /** toggle: "não se aplica" a esta linha (mostra "—", sem botão) — ex.: "Pago" só p/ contas com vencimento. */
  hideWhen?: (row: T) => boolean;
  /** Esta é a coluna recuada quando a linha é aninhada (ver indentRow). */
  indentable?: boolean;
}

interface DataGridProps<T extends { id: string }> {
  columns: GridColumn<T>[];
  rows: T[];
  blank: () => T;
  isComplete: (row: T) => boolean;
  onCommit: (row: T) => void;
  onDelete: (id: string) => void;
  addPlaceholder: string;
  total?: ReactNode;
  /** Moeda-base: fallback pra formatar/parsear e pra preencher a moeda vazia — a linha em branco
   *  mostra "—" na moeda (em vez de pré-selecionar); ao salvar sem escolher, cai nesta base. */
  defaultCurrency?: Currency;
  /** Classe extra por linha (ex.: tingir os itens DENTRO de uma fatura). */
  rowClass?: (row: T) => string | undefined;
  /** Recua a coluna marcada com `indentable` desta linha (ex.: itens aninhados sob a fatura). */
  indentRow?: (row: T) => boolean;
  /** Esta linha pode EXPANDIR um painel de detalhe abaixo dela (ex.: fatura → itens). */
  expandableRow?: (row: T) => boolean;
  /** Conteúdo do painel expandido de uma linha (renderizado só quando aberta). */
  renderRowDetail?: (row: T) => ReactNode;
}

const CELL_INPUT =
  "w-full bg-transparent outline-none text-[13.5px] text-text placeholder:text-faint rounded-[7px] px-2 py-1.5 focus:bg-accent-soft focus:ring-2 focus:ring-[var(--ring)] transition-colors";

const get = (row: object, key: string): unknown => (row as Record<string, unknown>)[key];

// ── Bottom sheet (padrão MOBILE dos pickers) ─────────────────────────────────
/** Folha que sobe de baixo: backdrop + painel com pegador + título opcional. Fecha no backdrop,
 *  no Escape e ao escolher. É o modelo ÚNICO de "escolher algo" no celular (moeda/dia/mês/select). */
function SheetShell({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // trava a rolagem do fundo enquanto a folha está aberta
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar" onClick={onClose} className="sheet-backdrop absolute inset-0 bg-black/55" />
      <div
        className="sheet-panel relative max-h-[82vh] overflow-y-auto scrollbar-subtle rounded-t-[22px] border-t border-border bg-card px-3.5 pt-2.5 shadow-[0_-10px_44px_-14px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong" />
        {title ? <div className="mb-3 px-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">{title}</div> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Uma opção (linha) dentro do sheet: rótulo à esquerda + check quando selecionada. Alvo de toque alto. */
function SheetOption({ label, selected, onClick }: { label: ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-[12px] px-3.5 py-3 text-left text-[15px] transition-colors outline-none",
        selected ? "bg-accent-soft text-text font-medium" : "text-muted hover:bg-card-hover hover:text-text active:bg-card-hover",
      )}
    >
      <span className="truncate">{label}</span>
      {selected ? <Check size={18} className="shrink-0 text-accent" /> : null}
    </button>
  );
}

// ── Células ───────────────────────────────────────────────────────────────────
function TextCell({
  value,
  placeholder,
  rowId,
  colKey,
  onCommit,
  onEnter,
}: {
  value: string;
  placeholder?: string;
  rowId: string;
  colKey: string;
  onCommit: (v: string) => void;
  onEnter: () => void;
}) {
  const [v, setV] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(value);
  }, [value, focused]);
  return (
    <input
      data-rowid={rowId}
      data-col={colKey}
      value={v}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
          onEnter();
        } else if (e.key === "Escape") {
          setV(value);
          e.currentTarget.blur();
        }
      }}
      className={CELL_INPUT}
    />
  );
}

function MoneyCell({
  value,
  currency,
  emptyCurrency,
  rowId,
  colKey,
  hideCurrency,
  onCommit,
  onCurrencyCommit,
  onEnter,
}: {
  value: number;
  currency: Currency;
  /** Moeda ainda não escolhida (linha-fantasma): mostra "—" no badge, mas formata com `currency`. */
  emptyCurrency?: boolean;
  rowId: string;
  colKey: string;
  hideCurrency?: boolean;
  onCommit: (v: number) => void;
  onCurrencyCommit: (c: Currency) => void;
  onEnter: () => void;
}) {
  const hidden = useUI((s) => s.numbersHidden);
  const [v, setV] = useState(() => formatAmountEdit(value, currency));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(formatAmountEdit(value, currency));
  }, [value, currency, focused]);
  const commit = () => {
    const n = parseLocaleNumber(v, currency);
    if (n != null && n !== value) onCommit(n);
    setV(formatAmountEdit(n ?? value, currency));
  };
  return (
    // Moeda colada no valor: o usuário vê e troca a moeda exatamente onde digita.
    // (hideCurrency: a moeda vive numa coluna própria — aqui fica só o valor.)
    <div className="flex items-center gap-1.5">
      {!hideCurrency ? (
        <CurrencyPicker value={currency} onCommit={onCurrencyCommit} className="shrink-0">
          {emptyCurrency ? <span className="px-1.5 text-[13px] text-faint">—</span> : <CurrencyBadge currency={currency} />}
        </CurrencyPicker>
      ) : null}
      <input
        data-rowid={rowId}
        data-col={colKey}
        inputMode="decimal"
        value={hidden && !focused ? MASK : v}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
            onEnter();
          } else if (e.key === "Escape") {
            setV(formatAmountEdit(value, currency));
            e.currentTarget.blur();
          }
        }}
        className={cn(CELL_INPUT, "text-right tabular flex-1 min-w-0 px-1.5")}
      />
    </div>
  );
}

function SelectCell({
  value,
  options,
  groups,
  optional,
  placeholder,
  rowId,
  colKey,
  title,
  onCommit,
}: {
  value: string;
  options: SelectOption[];
  groups?: { label: string; options: SelectOption[] }[];
  optional?: boolean;
  placeholder?: string;
  rowId: string;
  colKey: string;
  title?: string;
  onCommit: (v: string) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // Lista achatada p/ lookup do valor selecionado (agrupado ou plano).
  const flat = groups ? groups.flatMap((g) => g.options) : options;
  // Opcional sem opções disponíveis (ex.: Indexador fora de Renda Fixa): não editável.
  if (optional && flat.length === 0) {
    return <div className="px-2 py-1.5 text-[13px] text-faint">—</div>;
  }
  const hasValue = flat.some((o) => o.value === value);

  // MOBILE: gatilho + bottom sheet com as opções (em seções, se agrupadas).
  if (isMobile) {
    const current = flat.find((o) => o.value === value);
    return (
      <>
        <button
          type="button"
          data-rowid={rowId}
          data-col={colKey}
          onClick={() => setOpen(true)}
          className={cn(CELL_INPUT, "flex items-center justify-between gap-1 cursor-pointer", !current && "text-faint")}
        >
          <span className="truncate">{current?.label ?? placeholder ?? "—"}</span>
          <ChevronDown size={13} className="shrink-0 text-faint" />
        </button>
        {open ? (
          <SheetShell title={title} onClose={() => setOpen(false)}>
            <div className="space-y-1">
              {optional ? <SheetOption label="—" selected={!hasValue} onClick={() => { onCommit(""); setOpen(false); }} /> : null}
              {groups
                ? groups.map((g) => (
                    <div key={g.label}>
                      <div className="px-3.5 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{g.label}</div>
                      {g.options.map((o) => (
                        <SheetOption key={o.value} label={o.label} selected={o.value === value} onClick={() => { onCommit(o.value); setOpen(false); }} />
                      ))}
                    </div>
                  ))
                : options.map((o) => (
                    <SheetOption key={o.value} label={o.label} selected={o.value === value} onClick={() => { onCommit(o.value); setOpen(false); }} />
                  ))}
            </div>
          </SheetShell>
        ) : null}
      </>
    );
  }

  return (
    <select
      data-rowid={rowId}
      data-col={colKey}
      value={hasValue ? value : ""}
      onChange={(e) => onCommit(e.target.value)}
      className={cn(CELL_INPUT, "appearance-none cursor-pointer", !hasValue && "text-faint")}
    >
      {optional ? (
        <option value="" className="bg-card text-text">
          —
        </option>
      ) : (
        <option value="" disabled className="bg-card text-faint">
          {placeholder ?? "—"}
        </option>
      )}
      {groups
        ? groups.map((g) => (
            <optgroup key={g.label} label={g.label} className="bg-card text-text">
              {g.options.map((o) => (
                <option key={o.value} value={o.value} className="bg-card text-text">
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))
        : options.map((o) => (
            <option key={o.value} value={o.value} className="bg-card text-text">
              {o.label}
            </option>
          ))}
    </select>
  );
}

function NumberCell({
  value,
  currency,
  decimals,
  rowId,
  colKey,
  onCommit,
  onEnter,
}: {
  value: number | undefined;
  currency: Currency;
  decimals?: number;
  rowId: string;
  colKey: string;
  onCommit: (v: number | undefined) => void;
  onEnter: () => void;
}) {
  const fmt = (n: number | undefined) => formatNumberEdit(n, currency, decimals);
  const [v, setV] = useState(() => fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency, decimals, focused]);
  const commit = () => {
    if (v.trim() === "") {
      if (value != null) onCommit(undefined);
      return;
    }
    const n = parseLocaleNumber(v, currency);
    if (n == null) {
      setV(fmt(value));
      return;
    }
    if (n !== value) onCommit(n);
    setV(fmt(n));
  };
  return (
    <input
      data-rowid={rowId}
      data-col={colKey}
      inputMode="decimal"
      value={v}
      placeholder="—"
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
          onEnter();
        } else if (e.key === "Escape") {
          setV(fmt(value));
          e.currentTarget.blur();
        }
      }}
      className={cn(CELL_INPUT, "text-right tabular")}
    />
  );
}

/**
 * Seletor de DIA (1–31) — para o dia de vencimento. Em vez de digitar (e errar, ex.: "2026"),
 * o usuário escolhe num grid flutuante; o valor é sempre válido (1–31 ou vazio). Mesmo padrão
 * do CurrencyPicker (portal + Escape + sem roubar o foco do input em edição). Opcional: "—" limpa.
 */
function DayCell({
  value,
  rowId,
  colKey,
  align,
  title,
  onCommit,
}: {
  value: number | undefined;
  rowId: string;
  colKey: string;
  align?: "left" | "right";
  title?: string;
  onCommit: (v: number | undefined) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const MENU_W = 236;
  const MENU_H = 220;
  const openMenu = () => {
    if (isMobile) {
      setOpen(true);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      // Alinha a borda direita do menu à do gatilho (coluna é à direita) e prende na viewport.
      const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
      const below = r.bottom + 6;
      const top = below + MENU_H > window.innerHeight ? Math.max(8, r.top - MENU_H - 6) : below;
      setPos({ top, left });
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobile]);
  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };
  const pick = (d: number | undefined) => {
    if (d !== value) onCommit(d);
    close();
  };
  const today = new Date().getDate(); // dia do mês de hoje — marcado p/ achar rápido (não pré-seleciona)
  // Grade 1–31 + "—"; `big` = células maiores (bottom sheet no mobile).
  const grid = (big: boolean) => (
    <>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(d)}
            aria-current={d === today ? "date" : undefined}
            className={cn(
              "grid place-items-center rounded-[9px] tabular outline-none transition-colors",
              big ? "h-11 text-[15px]" : "h-[28px] text-[12.5px]",
              d === value
                ? "bg-accent text-[#0A0B0D] font-semibold"
                : d === today
                  ? "text-text ring-1 ring-inset ring-accent/55 hover:bg-card-hover"
                  : "text-muted hover:bg-card-hover hover:text-text",
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Sem dia"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pick(undefined)}
        className={cn("mt-1.5 w-full grid place-items-center rounded-[9px] border-t border-border text-faint hover:text-text hover:bg-card-hover transition-colors", big ? "h-11 text-[13px]" : "h-[28px] text-[12px]")}
      >
        —
      </button>
    </>
  );
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-rowid={rowId}
        data-col={colKey}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          CELL_INPUT,
          "flex items-center gap-1 tabular cursor-pointer hover:bg-card-hover",
          align === "right" ? "justify-end" : "justify-start",
          value == null && "text-faint",
        )}
      >
        <span>{value != null ? value : "—"}</span>
        <ChevronDown size={13} className="text-faint shrink-0" />
      </button>
      {isMobile ? (
        open ? (
          <SheetShell title={title} onClose={close}>
            {grid(true)}
          </SheetShell>
        ) : null
      ) : open && pos ? (
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="fixed z-50 rounded-[12px] border border-border-strong bg-card p-2 shadow-[var(--shadow-float)]" style={{ top: pos.top, left: pos.left, width: MENU_W }}>
              {grid(false)}
            </div>
          </>,
          document.body,
        )
      ) : null}
    </>
  );
}

/**
 * Seletor de MÊS (ano + grade de 12 meses) — em vez de digitar "2026-06" e errar. Valor = "AAAA-MM".
 * Mesmo padrão flutuante do DayCell (portal + Escape + sem roubar o foco do gatilho). As setas trocam
 * de ano SEM fechar o menu; clicar num mês confirma e fecha. O mês corrente fica marcado p/ achar rápido.
 */
function MonthCell({
  value,
  placeholder,
  rowId,
  colKey,
  align,
  max,
  title,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  rowId: string;
  colKey: string;
  align?: "left" | "right";
  /** maior mês selecionável ("AAAA-MM"); meses depois ficam desabilitados. */
  max?: string;
  title?: string;
  onCommit: (v: string) => void;
}) {
  const { i18n } = useTranslation();
  const locale = MONTH_LOCALE[(i18n.resolvedLanguage ?? "pt").slice(0, 2)] ?? "pt-BR";
  const isMobile = useIsMobile();
  const today = new Date();
  const vy = value ? Number(value.split("-")[0]) : undefined;
  const vm = value ? Number(value.split("-")[1]) : undefined;
  const [open, setOpen] = useState(false);
  const [navYear, setNavYear] = useState(vy ?? today.getFullYear());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const MENU_W = 236;
  const MENU_H = 248;
  const openMenu = () => {
    setNavYear(vy ?? today.getFullYear()); // reabre sempre no ano do valor (ou no atual)
    if (isMobile) {
      setOpen(true);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8));
      const below = r.bottom + 6;
      const top = below + MENU_H > window.innerHeight ? Math.max(8, r.top - MENU_H - 6) : below;
      setPos({ top, left });
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobile]);
  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };
  const pick = (m: number) => {
    onCommit(`${navYear}-${String(m).padStart(2, "0")}`);
    close();
  };
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: "short" }).replace(".", ""),
  );
  const label = value ? monthLabel(value, locale) : placeholder ?? "—";
  // Navegação de ano + grade de 12 meses; `big` = maior (bottom sheet no mobile).
  const menu = (big: boolean) => (
    <>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <button type="button" aria-label="Ano anterior" onMouseDown={(e) => e.preventDefault()} onClick={() => setNavYear((y) => y - 1)} className={cn("grid place-items-center rounded-[8px] text-muted hover:bg-card-hover hover:text-text", big ? "h-9 w-9" : "h-7 w-7")}>
          <ChevronLeft size={big ? 18 : 15} />
        </button>
        <span className={cn("font-semibold tabular text-text", big ? "text-[15px]" : "text-[13px]")}>{navYear}</span>
        <button type="button" aria-label="Próximo ano" onMouseDown={(e) => e.preventDefault()} onClick={() => setNavYear((y) => y + 1)} className={cn("grid place-items-center rounded-[8px] text-muted hover:bg-card-hover hover:text-text", big ? "h-9 w-9" : "h-7 w-7")}>
          <ChevronRight size={big ? 18 : 15} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {months.map((name, i) => {
          const m = i + 1;
          const ym = `${navYear}-${String(m).padStart(2, "0")}`;
          const disabled = max ? ym > max : false; // mês futuro: não selecionável
          const selected = navYear === vy && m === vm;
          const isToday = navYear === today.getFullYear() && m === today.getMonth() + 1;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={disabled ? undefined : () => pick(m)}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "grid place-items-center rounded-[8px] capitalize outline-none transition-colors",
                big ? "h-11 text-[14px]" : "h-[30px] text-[12.5px]",
                disabled
                  ? "text-faint opacity-40 cursor-not-allowed"
                  : selected
                    ? "bg-accent font-semibold text-[#0A0B0D]"
                    : isToday
                      ? "text-text ring-1 ring-inset ring-accent/55 hover:bg-card-hover"
                      : "text-muted hover:bg-card-hover hover:text-text",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </>
  );
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-rowid={rowId}
        data-col={colKey}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          CELL_INPUT,
          "flex items-center gap-1 cursor-pointer hover:bg-card-hover capitalize",
          align === "right" ? "justify-end" : "justify-start",
          !value && "text-faint",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={13} className="text-faint shrink-0" />
      </button>
      {isMobile ? (
        open ? (
          <SheetShell title={title} onClose={close}>
            {menu(true)}
          </SheetShell>
        ) : null
      ) : open && pos ? (
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="fixed z-50 rounded-[12px] border border-border-strong bg-card p-2 shadow-[var(--shadow-float)]" style={{ top: pos.top, left: pos.left, width: MENU_W }}>
              {menu(false)}
            </div>
          </>,
          document.body,
        )
      ) : null}
    </>
  );
}

/** Seletor de moeda: o gatilho (badge/símbolo) abre um menu flutuante com as moedas. */
function CurrencyPicker({
  value,
  onCommit,
  className,
  children,
}: {
  value: Currency;
  onCommit: (c: Currency) => void;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!isMobile) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobile]);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        // Não roubar o foco do input de valor: senão o blur dele auto-commita a
        // linha-fantasma ANTES da moeda ser aplicada (e a moeda escolhida se perde).
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        aria-label="Moeda"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "grid place-items-center min-w-[32px] min-h-[32px] rounded-[7px] outline-none focus:ring-2 focus:ring-[var(--ring)]",
          className,
        )}
      >
        {children}
      </button>
      {isMobile ? (
        open ? (
          <SheetShell title={t("common.currency")} onClose={() => { setOpen(false); btnRef.current?.focus(); }}>
            <div className="grid grid-cols-2 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onCommit(c);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[12px] border px-3.5 py-3 text-left transition-colors",
                    c === value ? "border-accent bg-accent-soft" : "border-border hover:bg-card-hover",
                  )}
                >
                  <CurrencyBadge currency={c} />
                  <span className="text-[14px] font-medium">{c}</span>
                </button>
              ))}
            </div>
          </SheetShell>
        ) : null
      ) : open && pos ? (
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 flex gap-1 rounded-[10px] border border-border-strong bg-card p-1.5 shadow-[var(--shadow-float)]"
              style={{ top: pos.top, left: pos.left }}
            >
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onCommit(c);
                    setOpen(false);
                  }}
                  className={cn("rounded-[7px] p-0.5", c === value && "ring-2 ring-[var(--ring)]")}
                >
                  <CurrencyBadge currency={c} />
                </button>
              ))}
            </div>
          </>,
          document.body,
        )
      ) : null}
    </>
  );
}

function CurrencyCell({ value, onCommit }: { value: Currency; onCommit: (c: Currency) => void }) {
  return (
    <CurrencyPicker value={value} onCommit={onCommit}>
      {value ? <CurrencyBadge currency={value} /> : <span className="px-1.5 text-[13px] text-faint">—</span>}
    </CurrencyPicker>
  );
}

/** Célula só-leitura (modo visitante): mostra o VALOR formatado, sem input. */
function ReadOnlyCell<T extends { id: string }>({ col, row }: { col: GridColumn<T>; row: T }) {
  const hidden = useUI((s) => s.numbersHidden);
  const v = get(row, col.key);
  switch (col.type) {
    case "currency":
      return (
        <div className="px-2">
          <CurrencyBadge currency={v as Currency} />
        </div>
      );
    case "money": {
      const cur = get(row, col.currencyKey ?? "currency") as Currency;
      return <div className="px-2 tabular text-text text-[13.5px]">{hidden ? MASK : formatAmountEdit((v as number) ?? 0, cur)}</div>;
    }
    case "number": {
      const cur = get(row, col.currencyKey ?? "currency") as Currency;
      return <div className="px-2 tabular text-text text-[13.5px]">{formatNumberEdit(v as number | undefined, cur, col.decimals) || "—"}</div>;
    }
    case "day":
      return <div className="px-2 tabular text-text text-[13.5px]">{(v as number | undefined) ?? "—"}</div>;
    case "month":
      return <div className="px-2 text-[13.5px] text-text capitalize">{(v as string) ? monthLabel(v as string, "pt-BR") : "—"}</div>;
    case "select": {
      const opts = col.optionGroups
        ? col.optionGroups.flatMap((g) => g.options)
        : col.optionsFor
          ? col.optionsFor(row)
          : col.options ?? [];
      return <div className="px-2 text-[13.5px] text-text">{opts.find((o) => o.value === v)?.label ?? "—"}</div>;
    }
    case "computed":
      return <div className="px-2 tabular text-muted">{hidden ? MASK : col.compute?.(row)}</div>;
    case "toggle":
      return <div className="flex justify-center">{v ? <Repeat size={14} className="text-accent" /> : null}</div>;
    case "text":
    default:
      return <div className="px-2 text-[13.5px] text-text truncate">{(v as string) || "—"}</div>;
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────────
export function DataGrid<T extends { id: string }>({
  columns,
  rows,
  blank,
  isComplete,
  onCommit,
  onDelete,
  addPlaceholder,
  total,
  rowClass,
  indentRow,
  defaultCurrency,
  expandableRow,
  renderRowDetail,
}: DataGridProps<T>) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<T>(() => blank());
  const hidden = useUI((s) => s.numbersHidden);
  const viewerMode = useViewer((s) => s.viewerMode);
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const canExpand = !!expandableRow && !!renderRowDetail;
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Coluna-guia (28px) só quando há linhas expansíveis — abriga o chevron sem sobrecarregar as demais.
  const template = (canExpand ? "28px " : "") + columns.map((c) => c.width).join(" ") + " 44px";
  const firstTextKey = columns.find((c) => c.type === "text")?.key ?? columns[0].key;
  const titleCol = columns.find((c) => c.key === firstTextKey) ?? columns[0];

  // Navegação por DOM (não por índice posicional): a lista é reordenada por id e
  // o useLiveQuery re-renderiza async, então focamos após o próximo frame.
  const nextInColumn = (rowId: string, colKey: string) =>
    requestAnimationFrame(() => {
      const cont = containerRef.current;
      if (!cont) return;
      const els = Array.from(cont.querySelectorAll<HTMLElement>(`[data-col="${colKey}"]`));
      const i = els.findIndex((e) => e.getAttribute("data-rowid") === rowId);
      const target =
        (i >= 0 ? els[i + 1] : undefined) ??
        els.find((e) => e.getAttribute("data-rowid") === "ghost");
      target?.focus();
    });

  const focusGhost = (colKey: string) =>
    requestAnimationFrame(() =>
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-rowid="ghost"][data-col="${colKey}"]`)
        ?.focus(),
    );

  // INVARIANTE: a linha-fantasma só recebe o VALOR (money/number) no blur do input,
  // nunca a cada tecla. É isso que deixa trocar a moeda no meio da digitação sem
  // auto-commitar a linha na moeda antiga (ver preventDefault no CurrencyPicker).
  // Se um dia empurrar o valor digitado pro ghost a cada onChange, o bug volta.
  // Salva a linha; se a moeda ficou vazia (a linha em branco não escolheu), cai na moeda-base.
  const emit = (row: T) => {
    const c = (row as Record<string, unknown>).currency;
    onCommit(defaultCurrency && (c === "" || c == null) ? ({ ...row, currency: defaultCurrency } as T) : row);
  };
  const commitGhostPatch = (patch: Partial<T>) => {
    const next = { ...ghost, ...patch } as T;
    if (isComplete(next)) {
      emit(next);
      setGhost(blank());
    } else {
      setGhost(next);
    }
  };
  const commitGhost = (key: string, value: unknown) => commitGhostPatch({ [key]: value } as Partial<T>);

  const renderCell = (col: GridColumn<T>, row: T, ghostRow: boolean): ReactNode => {
    if (viewerMode) return <ReadOnlyCell col={col} row={row} />;
    const rowId = ghostRow ? "ghost" : row.id;
    const commit = (value: unknown) => {
      // Deriva campos vinculados (ex.: país → moeda) junto com o valor da célula.
      const patch = { [col.key]: value, ...(col.derive ? col.derive(value as string, row) : {}) } as Partial<T>;
      return ghostRow ? commitGhostPatch(patch) : emit({ ...row, ...patch } as T);
    };
    const onEnter = ghostRow ? () => focusGhost(firstTextKey) : () => nextInColumn(row.id, col.key);

    switch (col.type) {
      case "currency":
        return <CurrencyCell value={get(row, col.key) as Currency} onCommit={commit} />;
      case "text":
        return (
          <TextCell
            value={(get(row, col.key) as string) ?? ""}
            placeholder={ghostRow && col.key === firstTextKey ? addPlaceholder : col.placeholder}
            rowId={rowId}
            colKey={col.key}
            onCommit={commit}
            onEnter={onEnter}
          />
        );
      case "select":
        return (
          <SelectCell
            value={(get(row, col.key) as string) ?? ""}
            options={col.optionsFor ? col.optionsFor(row) : col.options ?? []}
            groups={col.optionGroups}
            optional={col.optional}
            placeholder={col.placeholder}
            rowId={rowId}
            colKey={col.key}
            title={col.header}
            onCommit={commit}
          />
        );
      // "Dentro de" (fatura): 0 faturas → "—"; 1 fatura → CHECK que liga/desliga na única fatura;
      // 2+ faturas → select só das faturas. As faturas candidatas vêm de col.optionsFor.
      case "insideStatement": {
        const faturas = col.optionsFor ? col.optionsFor(row) : [];
        const current = (get(row, col.key) as string) ?? "";
        if (faturas.length === 0) return <div className="px-2 py-1.5 text-[13px] text-faint text-center">—</div>;
        if (faturas.length === 1) {
          const f = faturas[0];
          const on = current === f.value;
          return (
            <div className="flex justify-center">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={col.header}
                title={f.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(on ? "" : f.value)}
                className={cn(
                  "grid place-items-center w-6 h-6 rounded-[7px] border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                  on ? "text-[#0A0B0D] bg-accent border-accent" : "text-transparent border-border hover:border-border-strong hover:bg-card-hover",
                )}
              >
                <Check size={13} strokeWidth={3} />
              </button>
            </div>
          );
        }
        return <SelectCell value={current} options={faturas} optional placeholder={col.placeholder} rowId={rowId} colKey={col.key} title={col.header} onCommit={commit} />;
      }
      case "number":
        return (
          <NumberCell
            value={get(row, col.key) as number | undefined}
            currency={(get(row, col.currencyKey ?? "currency") as Currency) || defaultCurrency || ("BRL" as Currency)}
            decimals={col.decimals}
            rowId={rowId}
            colKey={col.key}
            onCommit={commit}
            onEnter={onEnter}
          />
        );
      case "day":
        return (
          <DayCell
            value={get(row, col.key) as number | undefined}
            rowId={rowId}
            colKey={col.key}
            align={col.align}
            title={col.header}
            onCommit={commit}
          />
        );
      case "month":
        return (
          <MonthCell
            value={(get(row, col.key) as string) ?? ""}
            placeholder={ghostRow && col.key === firstTextKey ? addPlaceholder : col.placeholder}
            rowId={rowId}
            colKey={col.key}
            align={col.align}
            max={col.maxMonth}
            title={col.header}
            onCommit={commit}
          />
        );
      case "money": {
        const curKey = col.currencyKey ?? "currency";
        const rawCur = get(row, curKey) as Currency | "" | undefined;
        return (
          <MoneyCell
            value={(get(row, col.key) as number) ?? 0}
            currency={(rawCur as Currency) || defaultCurrency || ("BRL" as Currency)}
            emptyCurrency={!rawCur}
            rowId={rowId}
            colKey={col.key}
            hideCurrency={col.hideCurrency}
            onCommit={commit}
            onCurrencyCommit={(c) =>
              ghostRow ? commitGhost(curKey, c) : emit({ ...row, [curKey]: c } as T)
            }
            onEnter={onEnter}
          />
        );
      }
      case "computed":
        return <div className="px-2 tabular text-muted">{hidden ? MASK : col.compute?.(row)}</div>;
      case "toggle": {
        if (col.hideWhen?.(row)) return <div className="px-2 py-1.5 text-center text-[13px] text-faint">—</div>;
        const on = col.isOn ? col.isOn(row) : Boolean(get(row, col.key));
        const Icon = col.icon ?? Repeat;
        return (
          <div className="flex justify-center">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={col.header}
              // Não roubar o foco de um input em edição (mesma razão do CurrencyPicker):
              // senão o blur auto-commita a linha-fantasma antes da hora.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(!on)}
              className={cn(
                "grid place-items-center w-7 h-7 rounded-[7px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                on ? "text-accent bg-accent-soft" : "text-faint hover:text-muted hover:bg-card-hover",
              )}
            >
              <Icon size={14} />
            </button>
          </div>
        );
      }
    }
  };

  // ── Layout MOBILE: cada linha vira um CARD com campos rotulados (dá pra inserir/editar sem
  //    tabela horizontal que estoura a tela). Reusa exatamente os mesmos renderCell. ──
  if (isMobile) {
    const restCols = columns.filter((c) => c.key !== titleCol.key);
    const mobileCard = (row: T, ghostRow: boolean) => {
      const isExpandable = canExpand && !ghostRow && expandableRow!(row);
      const isOpen = isExpandable && expanded.has(row.id);
      return (
      <div
        key={ghostRow ? "ghost" : row.id}
        className={cn(
          "relative rounded-[14px] border p-3.5",
          ghostRow ? "border-dashed border-border-strong bg-card/50" : "border-border bg-card",
          rowClass?.(row),
        )}
      >
        {!ghostRow && !viewerMode ? (
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            aria-label="Excluir"
            className="absolute top-2 right-2 p-1.5 rounded-md text-faint hover:text-neg hover:bg-bg transition-colors"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
        {/* título = 1º campo de texto (nome), largura cheia (chevron à esquerda p/ linhas expansíveis) */}
        <div className="flex items-center gap-1.5 pr-7">
          {isExpandable ? (
            <button
              type="button"
              onClick={() => toggleExpand(row.id)}
              aria-label={isOpen ? t("common.collapse") : t("common.expand")}
              aria-expanded={isOpen}
              className="shrink-0 p-1 -ml-1 rounded-md text-faint hover:text-text hover:bg-bg transition-colors"
            >
              <ChevronRight size={16} className={cn("transition-transform", isOpen && "rotate-90")} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">{renderCell(titleCol, row, ghostRow)}</div>
        </div>
        {restCols.length ? (
          <div className="mt-2 space-y-0.5 border-t border-[var(--grid-line)] pt-1.5">
            {restCols.map((col) => {
              const cell = renderCell(col, row, ghostRow);
              // Linha de "recibo": rótulo à esquerda, VALOR à direita. Alinha inputs/selects e os
              // seletores dia/mês (que são `.w-full`) à direita — MAS não os botões-ícone centrados
              // (check/recorrência/moeda, que são `w-7`/grid). O input de dinheiro encolhe pro
              // conteúdo (field-sizing) pra a moeda COLAR no valor em vez de ficar um vão.
              const align =
                "flex min-w-0 items-center justify-end text-right [&_input]:text-right [&_select]:text-right [&_.w-full]:justify-end [&_input.flex-1]:!w-auto [&_input.flex-1]:!flex-none [&_input.flex-1]:[field-sizing:content]";
              return col.header ? (
                <div key={col.key} className="flex items-center justify-between gap-3 min-h-[34px]">
                  <span className="shrink-0 font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-faint">{col.header}</span>
                  <div className={cn(align, "max-w-[70%]")}>{cell}</div>
                </div>
              ) : (
                <div key={col.key} className={cn(align, "min-h-[34px] items-center")}>{cell}</div>
              );
            })}
          </div>
        ) : null}
        {isOpen ? <div className="mt-2.5 border-t border-[var(--grid-line)] pt-2.5">{renderRowDetail!(row)}</div> : null}
      </div>
      );
    };
    return (
      <div ref={containerRef} className="space-y-2.5">
        {rows.map((row) => mobileCard(row, false))}
        {!viewerMode ? mobileCard(ghost, true) : null}
        {total ? (
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card2 px-4 py-3">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t("common.total")}</span>
            <span className="font-semibold tabular text-text">{total}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] overflow-x-auto overscroll-x-contain"
    >
      {/* Cabeçalho */}
      <div
        className="grid items-center bg-card2 border-b border-border"
        style={{ gridTemplateColumns: template }}
      >
        {canExpand ? <div /> : null}
        {columns.map((c) => (
          <div
            key={c.key}
            className={cn(
              "px-3 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted",
              c.align === "right" && "text-right",
              c.type === "toggle" && "px-1 text-center",
            )}
          >
            {c.header}
          </div>
        ))}
        <div />
      </div>

      {/* Linhas */}
      {rows.map((row) => {
        const isExpandable = canExpand && expandableRow!(row);
        const isOpen = isExpandable && expanded.has(row.id);
        return (
          <Fragment key={row.id}>
            <div
              className={cn("group grid items-center border-b border-[var(--grid-line)] hover:bg-card-hover transition-colors", isOpen && "bg-card-hover", rowClass?.(row))}
              style={{ gridTemplateColumns: template }}
            >
              {canExpand ? (
                <div className="flex justify-center">
                  {isExpandable ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(row.id)}
                      aria-label={isOpen ? t("common.collapse") : t("common.expand")}
                      aria-expanded={isOpen}
                      className="p-1 rounded-md text-faint hover:text-text hover:bg-bg transition-colors"
                    >
                      <ChevronRight size={15} className={cn("transition-transform", isOpen && "rotate-90")} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {columns.map((c) => (
                <div key={c.key} className={cn("px-2 py-1 min-w-0", c.align === "right" && "text-right", indentRow?.(row) && c.indentable && "pl-6")}>
                  {renderCell(c, row, false)}
                </div>
              ))}
              <div className="flex justify-center">
                {!viewerMode ? (
                  <button
                    type="button"
                    onClick={() => onDelete(row.id)}
                    aria-label="Excluir"
                    className="p-2 rounded-md text-faint hover:text-neg hover:bg-bg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            </div>
            {isOpen ? <div className="border-b border-[var(--grid-line)] bg-bg/40 px-2 py-2.5 sm:px-3">{renderRowDetail!(row)}</div> : null}
          </Fragment>
        );
      })}

      {/* Linha-fantasma (adicionar) — oculta no modo visitante */}
      {!viewerMode ? (
        <div
          className="grid items-center border-t border-dashed border-border-strong opacity-65 focus-within:opacity-100 transition-opacity"
          style={{ gridTemplateColumns: template }}
        >
          {canExpand ? <div /> : null}
          {columns.map((c) => (
            <div key={c.key} className={cn("px-2 py-1 min-w-0", c.align === "right" && "text-right")}>
              {renderCell(c, ghost, true)}
            </div>
          ))}
          <div />
        </div>
      ) : null}

      {/* Rodapé: atalhos + total */}
      {total ? (
        <div
          className="grid items-center bg-card2 border-t border-border"
          style={{ gridTemplateColumns: template }}
        >
          <div className="px-3 py-2.5 text-[11px] text-muted" style={{ gridColumn: "1 / -2" }}>
            {!viewerMode ? <span className="hidden sm:inline">↵ confirmar · ⇥ próximo campo · ⎋ cancelar</span> : null}
          </div>
          <div
            className="px-3 py-2.5 text-right font-semibold tabular text-text"
            style={{ gridColumn: "-3 / -1" }}
          >
            {total}
          </div>
        </div>
      ) : null}
    </div>
  );
}
