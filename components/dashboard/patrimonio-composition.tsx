import { Panel, PanelHeader } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils/cn";

/**
 * Composição do patrimônio — barras horizontais por classe, mostrando
 * peso percentual e valor de cada bucket.
 *
 * Buckets:
 *  - Líquido: caixa em contas (checking + savings + cash), sem cartão
 *  - Renda fixa: saldo em ativos de RF (subset de portfolio)
 *  - Renda variável: FIIs + ações + ETFs + cripto (subset de portfolio)
 *  - Bens físicos: imóveis, veículos, etc.
 *  - Cartão (passivo): saldo de cartão de crédito como subtração visual
 *
 * Útil pra ver de relance se há concentração demais em uma classe.
 */
export type CompositionBucket = {
  key: string;
  label: string;
  value: number;
  tone: "navy" | "olive" | "gold" | "ink" | "rust";
  hint?: string;
};

export function PatrimonioComposition({
  buckets,
  total,
}: {
  buckets: CompositionBucket[];
  /** Total positivo (sem subtrair passivos) — base do %. */
  total: number;
}) {
  // Filtra valores essencialmente zero e ordena por valor desc
  const visible = buckets
    .filter((b) => Math.abs(b.value) > 0.5)
    .sort((a, b) => b.value - a.value);

  return (
    <Panel>
      <PanelHeader
        title="Composição do patrimônio"
        meta="onde está cada real"
      />
      {visible.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          Sem dados pra compor — cadastre contas, investimentos ou bens.
        </p>
      ) : (
        <ul className="space-y-3.5">
          {visible.map((b) => (
            <BucketRow key={b.key} bucket={b} total={total} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BucketRow({
  bucket,
  total,
}: {
  bucket: CompositionBucket;
  total: number;
}) {
  const pct = total > 0 ? (bucket.value / total) * 100 : 0;
  const pctDisplay = pct.toFixed(pct >= 10 ? 0 : 1).replace(".", ",");
  const barWidth = Math.min(100, Math.max(0, Math.abs(pct)));
  const bar =
    bucket.tone === "navy"
      ? "bg-navy-700"
      : bucket.tone === "olive"
        ? "bg-olive-600"
        : bucket.tone === "gold"
          ? "bg-gold-600"
          : bucket.tone === "rust"
            ? "bg-rust-600"
            : "bg-ink-800";

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-foreground">{bucket.label}</span>
          {bucket.hint ? (
            <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] ml-2">
              {bucket.hint}
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <Money
            value={bucket.value}
            className="font-mono text-[13px] tabular-nums text-foreground inline-flex !flex-row !items-baseline"
          />
          <span className="font-mono text-[10.5px] text-faint-foreground tabular-nums w-10 text-right">
            {pctDisplay}%
          </span>
        </div>
      </div>
      <div className="h-[5px] bg-bone-100 dark:bg-ink-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bar)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </li>
  );
}
