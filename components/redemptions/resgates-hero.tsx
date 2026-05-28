import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * Hero da página /resgates — responde "quanto posso tirar agora sem
 * tocar no principal?" em uma olhada de 1 segundo.
 *
 * Mostra:
 *  - Sacável agora (= soma de baseBalance - initial_amount por RF) — o número
 *    principal, em letra grande
 *  - Rendimento acumulado live: aquele contador que respira (já existe na home)
 *  - Renda diária estimada
 *  - Renda mensal estimada
 *  - Cobertura: % da despesa fixa média que essa renda cobre
 *  - Sweet spot: "no ritmo atual, pode sacar até R$ X/mês indefinidamente"
 */
export function ResgatesHero({
  sacavelAgora,
  dailyYield,
  monthlyYield,
  monthlyExpense,
  coverageRatio,
  isBusinessDayToday,
}: {
  sacavelAgora: number;
  dailyYield: number;
  monthlyYield: number;
  monthlyExpense: number;
  /** monthlyYield / monthlyExpense (0..2+) */
  coverageRatio: number;
  isBusinessDayToday: boolean;
}) {
  const coveragePct = Math.min(200, Math.round(coverageRatio * 100));

  // Sweet spot: quanto dá pra sacar /mês indefinidamente sem reduzir o principal
  // = monthlyYield (assumindo reaplicação do que não saca). É conservador
  // porque ignora composição, mas dá a referência mental certa.
  const sustainableMonthly = monthlyYield;

  // Quantos meses de despesa fixa dá pra cobrir SÓ com o rendimento acumulado
  const monthsCovered = monthlyExpense > 0 ? sacavelAgora / monthlyExpense : 0;

  return (
    <section className="relative rounded-[var(--radius-xl)] bg-ink-950 text-white p-9 sm:p-12 mb-6 overflow-hidden shadow-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px]"
        style={{ background: "radial-gradient(circle, rgba(59,231,114,0.16), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 w-[360px] h-[360px]"
        style={{ background: "radial-gradient(circle, rgba(176,123,50,0.12), transparent 70%)" }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-8 mb-7">
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 mb-3 font-medium">
              Capacidade de saque · agora
            </div>
            <div className="font-mono text-[48px] sm:text-[56px] font-light leading-none tracking-[-0.04em] text-[#3be772]">
              <MoneyMask>{formatMoney(sacavelAgora)}</MoneyMask>
            </div>
            <p className="text-[13px] text-navy-300 mt-3 leading-relaxed max-w-[420px]">
              Lucro acumulado em toda a sua renda fixa.{" "}
              <em className="italic">Pode tirar até esse valor sem reduzir o principal.</em>
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end text-right gap-2 max-w-[260px]">
            <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-navy-400 font-medium">
              Equivale a
            </div>
            <div className="font-mono text-[28px] text-white font-light leading-none">
              {monthsCovered >= 0.05 ? monthsCovered.toFixed(1).replace(".", ",") : "—"}{" "}
              <span className="text-[14px] text-navy-300">
                {monthsCovered >= 0.05 && monthsCovered <= 1.05 ? "mês" : "meses"}
              </span>
            </div>
            <div className="text-[11.5px] text-navy-400">de despesa fixa coberta</div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-ink-700 to-transparent mb-6" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Metric
            label="Rendendo /dia"
            value={formatMoney(dailyYield)}
            hint={isBusinessDayToday ? "dia útil ativo" : "pausado (fds/feriado)"}
            tone="olive"
          />
          <Metric
            label="Renda /mês"
            value={formatMoney(monthlyYield)}
            hint="≈ daily × 21 dias úteis"
            tone="olive"
          />
          <Metric
            label="Cobertura"
            value={`${coveragePct}%`}
            hint={`despesa média ${formatMoney(monthlyExpense)}/mês`}
            tone={coverageRatio >= 1 ? "olive" : coverageRatio >= 0.5 ? "gold" : "default"}
          />
          <Metric
            label="Sustentável /mês"
            value={formatMoney(sustainableMonthly)}
            hint="pode sacar isso indefinidamente sem encolher"
            tone="olive"
          />
        </div>

        {coverageRatio >= 1 ? (
          <div className="mt-7 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-olive-600/20 text-[#3be772] text-[12px] font-medium">
            <span className="font-mono text-[10px]">★</span>
            Você já pode viver da renda — cobertura {formatPercent(coverageRatio, 0)}.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "olive" | "gold" | "default";
}) {
  const colorClass =
    tone === "olive"
      ? "text-[#3be772]"
      : tone === "gold"
        ? "text-gold-600"
        : "text-white";
  return (
    <div>
      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-navy-400 mb-1.5 font-medium">
        {label}
      </div>
      <div className={`font-mono text-[20px] sm:text-[22px] tracking-[-0.02em] font-light ${colorClass}`}>
        <MoneyMask>{value}</MoneyMask>
      </div>
      <div className="text-[11px] font-mono text-navy-400 mt-0.5">{hint}</div>
    </div>
  );
}
