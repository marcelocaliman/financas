import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyBadge } from "@/components/common/currency-badge";
import { CURRENCIES, type Currency } from "@/money/currency";
import { formatAmountEdit, formatNumberEdit, parseLocaleNumber } from "@/money/parse";
import { useUI } from "@/store/ui";
import { useViewer } from "@/store/viewer";

const MASK = "••••";

// ── Tipos ───────────────────────────────────────────────────────────────────
export type ColType = "currency" | "text" | "select" | "money" | "number" | "day" | "computed" | "toggle";

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
  /** select opcional: inclui um "—" (vazio) e o valor pode ficar em branco. */
  optional?: boolean;
  currencyKey?: string; // money/number: campo da moeda p/ o locale (default "currency")
  /** number: casas decimais FIXAS (ex.: preço médio = 2). Indefinido = flexível (qtd). */
  decimals?: number;
  placeholder?: string;
  compute?: (row: T) => ReactNode;
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
}

const CELL_INPUT =
  "w-full bg-transparent outline-none text-[13.5px] text-text placeholder:text-faint rounded-[7px] px-2 py-1.5 focus:bg-accent-soft focus:ring-2 focus:ring-[var(--ring)] transition-colors";

const get = (row: object, key: string): unknown => (row as Record<string, unknown>)[key];

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
  rowId,
  colKey,
  onCommit,
  onCurrencyCommit,
  onEnter,
}: {
  value: number;
  currency: Currency;
  rowId: string;
  colKey: string;
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
    <div className="flex items-center gap-1.5">
      <CurrencyPicker value={currency} onCommit={onCurrencyCommit} className="shrink-0">
        <CurrencyBadge currency={currency} />
      </CurrencyPicker>
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
  optional,
  placeholder,
  rowId,
  colKey,
  onCommit,
}: {
  value: string;
  options: SelectOption[];
  optional?: boolean;
  placeholder?: string;
  rowId: string;
  colKey: string;
  onCommit: (v: string) => void;
}) {
  // Opcional sem opções disponíveis (ex.: Indexador fora de Renda Fixa): não editável.
  if (optional && options.length === 0) {
    return <div className="px-2 py-1.5 text-[13px] text-faint">—</div>;
  }
  const hasValue = options.some((o) => o.value === value);
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
      {options.map((o) => (
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
  onCommit,
}: {
  value: number | undefined;
  rowId: string;
  colKey: string;
  align?: "left" | "right";
  onCommit: (v: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const MENU_W = 236;
  const MENU_H = 220;
  const openMenu = () => {
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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const pick = (d: number | undefined) => {
    if (d !== value) onCommit(d);
    setOpen(false);
    btnRef.current?.focus();
  };
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
      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div
                className="fixed z-50 rounded-[12px] border border-border-strong bg-card p-2 shadow-[var(--shadow-float)]"
                style={{ top: pos.top, left: pos.left, width: MENU_W }}
              >
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      type="button"
                      // Não roubar o foco do gatilho (mesma razão do CurrencyPicker).
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(d)}
                      className={cn(
                        "h-[28px] grid place-items-center rounded-[7px] text-[12.5px] tabular outline-none transition-colors",
                        d === value
                          ? "bg-accent text-[#0A0B0D] font-semibold"
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
                  className="mt-1.5 w-full h-[28px] grid place-items-center rounded-[7px] border-t border-border text-[12px] text-faint hover:text-text hover:bg-card-hover transition-colors"
                >
                  —
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
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
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
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
      {open && pos
        ? createPortal(
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
        : null}
    </>
  );
}

function CurrencyCell({ value, onCommit }: { value: Currency; onCommit: (c: Currency) => void }) {
  return (
    <CurrencyPicker value={value} onCommit={onCommit}>
      <CurrencyBadge currency={value} />
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
    case "select": {
      const opts = col.optionsFor ? col.optionsFor(row) : col.options ?? [];
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
}: DataGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<T>(() => blank());
  const hidden = useUI((s) => s.numbersHidden);
  const viewerMode = useViewer((s) => s.viewerMode);

  const template = columns.map((c) => c.width).join(" ") + " 44px";
  const firstTextKey = columns.find((c) => c.type === "text")?.key ?? columns[0].key;

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
  const commitGhost = (key: string, value: unknown) => {
    const next = { ...ghost, [key]: value } as T;
    if (isComplete(next)) {
      onCommit(next);
      setGhost(blank());
    } else {
      setGhost(next);
    }
  };

  const renderCell = (col: GridColumn<T>, row: T, ghostRow: boolean): ReactNode => {
    if (viewerMode) return <ReadOnlyCell col={col} row={row} />;
    const rowId = ghostRow ? "ghost" : row.id;
    const commit = (value: unknown) =>
      ghostRow ? commitGhost(col.key, value) : onCommit({ ...row, [col.key]: value } as T);
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
            optional={col.optional}
            placeholder={col.placeholder}
            rowId={rowId}
            colKey={col.key}
            onCommit={commit}
          />
        );
      case "number":
        return (
          <NumberCell
            value={get(row, col.key) as number | undefined}
            currency={get(row, col.currencyKey ?? "currency") as Currency}
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
            onCommit={commit}
          />
        );
      case "money": {
        const curKey = col.currencyKey ?? "currency";
        return (
          <MoneyCell
            value={(get(row, col.key) as number) ?? 0}
            currency={get(row, curKey) as Currency}
            rowId={rowId}
            colKey={col.key}
            onCommit={commit}
            onCurrencyCommit={(c) =>
              ghostRow ? commitGhost(curKey, c) : onCommit({ ...row, [curKey]: c } as T)
            }
            onEnter={onEnter}
          />
        );
      }
      case "computed":
        return <div className="px-2 tabular text-muted">{hidden ? MASK : col.compute?.(row)}</div>;
      case "toggle": {
        const on = Boolean(get(row, col.key));
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
              <Repeat size={14} />
            </button>
          </div>
        );
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden"
    >
      {/* Cabeçalho */}
      <div
        className="grid items-center bg-card2 border-b border-border"
        style={{ gridTemplateColumns: template }}
      >
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
      {rows.map((row) => (
        <div
          key={row.id}
          className="group grid items-center border-b border-[var(--grid-line)] hover:bg-card-hover transition-colors"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((c) => (
            <div key={c.key} className={cn("px-2 py-1 min-w-0", c.align === "right" && "text-right")}>
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
      ))}

      {/* Linha-fantasma (adicionar) — oculta no modo visitante */}
      {!viewerMode ? (
        <div
          className="grid items-center border-t border-dashed border-border-strong opacity-65 focus-within:opacity-100 transition-opacity"
          style={{ gridTemplateColumns: template }}
        >
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
