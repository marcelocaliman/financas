import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyBadge } from "@/components/common/currency-badge";
import { CURRENCIES, type Currency } from "@/money/currency";
import { formatAmountEdit, formatNumberEdit, parseLocaleNumber } from "@/money/parse";
import { useUI } from "@/store/ui";

const MASK = "••••";

// ── Tipos ───────────────────────────────────────────────────────────────────
export type ColType = "currency" | "text" | "select" | "money" | "number" | "computed" | "toggle";

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
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              aria-label="Excluir"
              className="p-2 rounded-md text-faint hover:text-neg hover:bg-bg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}

      {/* Linha-fantasma */}
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

      {/* Rodapé: atalhos + total */}
      {total ? (
        <div
          className="grid items-center bg-card2 border-t border-border"
          style={{ gridTemplateColumns: template }}
        >
          <div className="px-3 py-2.5 text-[11px] text-muted" style={{ gridColumn: "1 / -2" }}>
            <span className="hidden sm:inline">↵ confirmar · ⇥ próximo campo · ⎋ cancelar</span>
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
