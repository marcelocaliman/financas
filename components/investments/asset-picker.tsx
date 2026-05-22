"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AssetTemplate } from "@/lib/financial/asset-catalog";

const ASSET_TYPE_BADGE: Record<AssetTemplate["asset_type"], string> = {
  fii: "FII",
  fixed_income_public: "Tesouro",
  fixed_income_private: "Renda fixa",
  stock: "Ação",
  etf: "ETF",
  crypto: "Cripto",
};

export function AssetPicker({
  value,
  onSelect,
  onClear,
  autoFocus,
}: {
  value: AssetTemplate | null;
  onSelect: (asset: AssetTemplate) => void;
  onClear: () => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca server-side com debounce. Quando query fica vazia, results virtuais
  // são [] na renderização (não precisa setState).
  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/assets/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await res.json()) as { results: AssetTemplate[] };
        setResults(data.results);
        setActiveIdx(0);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed]);

  const displayResults = trimmed ? results : [];

  if (value) {
    return (
      <div className="rounded-[10px] border border-navy-200 bg-navy-50 dark:bg-navy-900/30 dark:border-navy-700 px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-[8px] bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 grid place-items-center shrink-0">
          <Sparkles className="w-4 h-4" strokeWidth={1.7} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[13.5px] font-medium">{value.ticker}</span>
            <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-navy-700 dark:text-navy-300 font-medium">
              {ASSET_TYPE_BADGE[value.asset_type]}
            </span>
            {value.source === "tesouro" ? (
              <span className="text-[10px] font-mono text-olive-700 dark:text-olive-500 bg-olive-100 dark:bg-olive-700/30 px-1.5 py-0.5 rounded font-medium">
                ao vivo
              </span>
            ) : value.source === "heuristic" ? (
              <span className="text-[10px] font-mono text-gold-700 dark:text-gold-500 bg-gold-100 dark:bg-gold-700/30 px-1.5 py-0.5 rounded font-medium">
                inferido
              </span>
            ) : null}
          </div>
          {value.name !== value.ticker ? (
            <div className="text-[12.5px] text-muted-foreground mt-0.5">{value.name}</div>
          ) : null}
          <div className="text-[11.5px] font-mono text-faint-foreground mt-1 tracking-[0.02em]">
            {summarize(value)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1.5 text-faint-foreground hover:text-foreground"
          aria-label="Trocar ativo"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.7} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint-foreground pointer-events-none"
          strokeWidth={2}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(displayResults.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (displayResults[activeIdx]) {
                onSelect(displayResults[activeIdx]);
                setQuery("");
                setOpen(false);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          autoFocus={autoFocus}
          placeholder="Tesouro Selic 2031, MXRF11, PETR4…"
          className="h-12 w-full rounded-[10px] border border-border-strong bg-surface pl-10 pr-3 text-[14.5px] text-foreground placeholder:text-faint-foreground focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100 dark:focus:ring-navy-900/50 transition-colors"
        />
      </div>
      {open && trimmed ? (
        <ul className="absolute z-30 top-full mt-1.5 w-full bg-surface border border-border-strong rounded-[10px] shadow-md py-1.5 max-h-[320px] overflow-y-auto">
          {loading ? (
            <li className="px-3 py-2 text-[12.5px] text-muted-foreground font-mono">Buscando…</li>
          ) : displayResults.length === 0 ? (
            <li className="px-3 py-3 text-[13px] text-muted-foreground">
              Nada encontrado. Você pode <button type="button" onClick={() => {
                onSelect({
                  ticker: query,
                  name: query,
                  asset_type: "fixed_income_private",
                  indexer: "cdi",
                  indexer_multiplier: 1.0,
                  tax_regime: "regressive",
                  source: "heuristic",
                });
              }} className="text-navy-700 dark:text-navy-300 font-medium hover:underline">cadastrar manualmente como CDB</button>.
            </li>
          ) : (
            displayResults.map((item, idx) => (
              <li key={item.ticker + idx}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setQuery("");
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-3 text-[13.5px]",
                    activeIdx === idx ? "bg-surface-muted" : "",
                  )}
                >
                  <span className="font-mono font-medium min-w-[110px] text-foreground">
                    {item.ticker}
                  </span>
                  <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-faint-foreground font-medium min-w-[60px]">
                    {ASSET_TYPE_BADGE[item.asset_type]}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">{item.name}</span>
                  {item.source === "tesouro" ? (
                    <span className="text-[10px] font-mono text-olive-700 dark:text-olive-500 font-medium">live</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function summarize(a: AssetTemplate): string {
  const parts: string[] = [];
  if (a.indexer === "selic" || a.indexer === "cdi") {
    const m = Math.round((a.indexer_multiplier ?? 1) * 100);
    parts.push(`${m}% ${a.indexer.toUpperCase()}`);
  } else if (a.indexer === "ipca") {
    parts.push(a.fixed_rate ? `IPCA + ${a.fixed_rate.toFixed(2)}%` : "IPCA+");
  } else if (a.indexer === "fixed") {
    parts.push(a.fixed_rate ? `${a.fixed_rate.toFixed(2)}% a.a.` : "Prefixado");
  }
  parts.push(a.tax_regime === "exempt" ? "IR isento" : "IR regressivo");
  return parts.join(" · ");
}
