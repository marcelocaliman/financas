import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRates, type RatesSource } from "@/store/rates";
import { CURRENCIES, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<RatesSource, string> = {
  live: "Automático",
  manual: "Manual",
  default: "Padrão",
};

function ago(ts: number | null): string {
  if (!ts) return "nunca";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** Cotação das moedas: fonte automática (diária), cache e override manual (fallback). */
export function ExchangeRates() {
  const rates = useRates((s) => s.rates);
  const manual = useRates((s) => s.manual);
  const source = useRates((s) => s.source);
  const updatedAt = useRates((s) => s.updatedAt);
  const status = useRates((s) => s.status);
  const refresh = useRates((s) => s.refresh);
  const setManual = useRates((s) => s.setManual);
  const clearManual = useRates((s) => s.clearManual);

  const others = CURRENCIES.filter((c) => c !== "BRL");

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="text-[14px] font-semibold">Cotação das moedas</div>
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={status === "loading"}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] border border-border text-[12.5px] text-muted hover:text-text hover:bg-card-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(status === "loading" && "animate-spin")} />
          Atualizar agora
        </button>
      </div>
      <p className="text-[12px] text-faint mb-5 leading-relaxed">
        Fonte: <span className="text-muted">{SOURCE_LABEL[source]}</span> · atualizado {ago(updatedAt)} · base R$ (BRL).
        {status === "error" ? (
          <span className="text-neg"> Falha ao atualizar — usando o último valor em cache.</span>
        ) : null}
      </p>

      <div className="space-y-1.5">
        {others.map((c) => (
          <RateRow
            key={c}
            cur={c}
            value={rates[c]}
            isManual={manual[c] != null}
            onSet={(v) => setManual(c, v)}
            onAuto={() => clearManual(c)}
          />
        ))}
      </div>

      <p className="text-[11.5px] text-faint mt-4 leading-relaxed">
        Atualiza sozinho pelo menos 1× ao dia. Você pode fixar uma taxa manual como fallback —
        toque em “automático” pra voltar à cotação do dia.
      </p>
    </div>
  );
}

function RateRow({
  cur,
  value,
  isManual,
  onSet,
  onAuto,
}: {
  cur: Currency;
  value: number;
  isManual: boolean;
  onSet: (v: number) => void;
  onAuto: () => void;
}) {
  const [v, setV] = useState(() => value.toFixed(4));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(value.toFixed(4));
  }, [value, focused]);

  const commit = () => {
    const n = Number(v.replace(",", "."));
    if (!Number.isNaN(n) && n > 0 && Math.abs(n - value) > 1e-9) onSet(n);
    else setV(value.toFixed(4));
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-[108px] shrink-0 text-[13.5px]">
        1 {CURRENCY_SYMBOL[cur]} <span className="text-faint tabular">({cur})</span>
      </span>
      <span className="text-faint text-[13px]">=</span>
      <input
        inputMode="decimal"
        value={v}
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
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            setV(value.toFixed(4));
            e.currentTarget.blur();
          }
        }}
        className="w-28 h-9 px-2.5 rounded-[8px] border border-border bg-card text-[13.5px] tabular text-right outline-none focus:border-accent"
      />
      <span className="text-[13px] text-muted">R$</span>
      {isManual ? (
        <button type="button" onClick={onAuto} className="text-[11.5px] text-accent hover:underline ml-0.5">
          automático
        </button>
      ) : null}
    </div>
  );
}
