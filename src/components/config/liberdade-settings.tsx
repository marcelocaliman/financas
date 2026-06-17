import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { useProjection } from "@/store/projection";
import { useSettings } from "@/hooks/use-settings";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { defaultEligibleClass } from "@/domain/taxonomy";
import { useUI } from "@/store/ui";
import { actions } from "@/data/actions";
import { LIBERDADE_DEFAULTS } from "@/hooks/use-liberdade";
import { CURRENCY_SYMBOL } from "@/money/currency";
import {
  HEALTH_DIMS,
  DEFAULT_HEALTH_WEIGHTS,
  DEFAULT_SAVINGS_TARGET,
  DEFAULT_MAX_DEBT_RATIO,
} from "@/finance/health";
import { cn } from "@/lib/utils";

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-[16px] border border-border bg-card p-6">{children}</div>;
}
function SubHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <div className="eyebrow mb-1.5">{children}</div>
      {hint ? <p className="text-[12px] text-muted leading-relaxed mb-3.5 max-w-md">{hint}</p> : null}
    </>
  );
}

/** Input numérico que confirma no blur/Enter (mantém o texto enquanto edita). */
function NumInput({ value, onCommit, suffix, min = 0, className }: { value: number; onCommit: (v: number) => void; suffix?: string; min?: number; className?: string }) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(String(value));
  }, [value, focused]);
  const commit = () => {
    const n = Number(v.replace(",", "."));
    if (!Number.isNaN(n) && n >= min) onCommit(n);
    else setV(String(value));
  };
  return (
    <div className={cn("relative", className)}>
      <input
        inputMode="decimal"
        value={v}
        onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[14px] tabular outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
      />
      {suffix ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span> : null}
    </div>
  );
}

/** Configuração da métrica Liberdade — tudo editável (NADA fixo). */
export function LiberdadeSettings() {
  const { t } = useTranslation();
  const base = useUI((s) => s.baseCurrency);
  const proj = useProjection();
  const settings = useSettings();
  const tax = useTaxonomy();
  const cfg = settings.liberdade ?? {};

  const sym = CURRENCY_SYMBOL[base];
  const costMonths = cfg.costMonths ?? LIBERDADE_DEFAULTS.costMonths;
  const reserveMonths = cfg.reserveMonths ?? LIBERDADE_DEFAULTS.reserveMonths;
  const streakMin = cfg.streakMinBalance ?? LIBERDADE_DEFAULTS.streakMinBalance;
  const milestones = cfg.milestones ?? [];
  const health = settings.health ?? {};
  const compromisso = settings.compromisso ?? {};

  // Mantém a lista crua enquanto edita (inclui linhas em branco); o hook ignora ≤ 0 na leitura.
  const setMilestones = (next: number[]) => actions.setLiberdade({ milestones: next });

  return (
    <div className="space-y-5">
      {/* Premissas numéricas */}
      <Card>
        <SubHeading hint={t("liberdade.cfg.basisHint")}>{t("liberdade.cfg.basis")}</SubHeading>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("liberdade.cfg.withdrawalRate")}</span>
            <NumInput value={proj.withdrawalRate} onCommit={(v) => proj.set({ withdrawalRate: v })} suffix="%" />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("liberdade.cfg.costMonths")}</span>
            <NumInput value={costMonths} min={1} onCommit={(v) => actions.setLiberdade({ costMonths: Math.round(v) })} suffix={t("liberdade.cfg.monthsUnit")} />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("liberdade.cfg.reserveMonths")}</span>
            <NumInput value={reserveMonths} min={1} onCommit={(v) => actions.setLiberdade({ reserveMonths: Math.round(v) })} suffix={t("liberdade.cfg.monthsUnit")} />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("liberdade.cfg.streakMin")}</span>
            <NumInput value={streakMin} onCommit={(v) => actions.setLiberdade({ streakMinBalance: v })} suffix={sym} />
          </label>
        </div>
      </Card>

      {/* Patrimônio elegível — toggle por classe */}
      <Card>
        <SubHeading hint={t("liberdade.cfg.eligibleHint")}>{t("liberdade.cfg.eligible")}</SubHeading>
        <div className="flex flex-wrap gap-2">
          {tax.assetClasses.map((c) => {
            const on = (cfg.eligibleClasses ?? {})[c.id] ?? defaultEligibleClass(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => actions.setEligibleClass(c.id, !on)}
                aria-pressed={on}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
                  on ? "bg-accent-soft border-accent/40 text-text" : "border-border text-faint hover:text-muted line-through",
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Renda passiva externa — categorias que abatem o custo */}
      <Card>
        <SubHeading hint={t("liberdade.cfg.passiveHint")}>{t("liberdade.cfg.passive")}</SubHeading>
        <div className="flex flex-wrap gap-2">
          {tax.incomeCategories.map((c) => {
            const list = cfg.passiveCategories ?? ["aluguel"];
            const on = list.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  actions.setLiberdade({ passiveCategories: on ? list.filter((x) => x !== c.id) : [...list, c.id] })
                }
                aria-pressed={on}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
                  on ? "bg-accent-soft border-accent/40 text-text" : "border-border text-faint hover:text-muted",
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Marcos de patrimônio editáveis */}
      <Card>
        <SubHeading hint={t("liberdade.cfg.milestonesHint")}>{t("liberdade.cfg.milestones")}</SubHeading>
        {milestones.length === 0 ? (
          <p className="text-[12px] text-faint mb-3">{t("liberdade.cfg.milestonesAuto")}</p>
        ) : null}
        <div className="space-y-2">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2 max-w-xs">
              <NumInput
                value={m}
                onCommit={(v) => setMilestones(milestones.map((x, j) => (j === i ? v : x)))}
                suffix={sym}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}
                aria-label={t("liberdade.cfg.removeMilestone")}
                className="grid place-items-center w-9 h-9 rounded-[8px] text-faint hover:text-neg hover:bg-card-hover transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => actions.setLiberdade({ milestones: [...milestones, 0] })}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
        >
          <Plus size={15} /> {t("liberdade.cfg.addMilestone")}
        </button>
      </Card>

      {/* Compromisso — aporte mensal planejado */}
      <Card>
        <SubHeading hint={t("compromisso.cfg.hint")}>{t("compromisso.title")}</SubHeading>
        <label className="block max-w-xs">
          <span className="eyebrow block mb-1.5">{t("compromisso.cfg.monthly")}</span>
          <NumInput value={compromisso.monthly ?? 0} onCommit={(v) => actions.setCompromisso({ monthly: v })} suffix={sym} />
        </label>
      </Card>

      {/* Saúde financeira — limiares + pesos */}
      <Card>
        <SubHeading hint={t("health.cfg.hint")}>{t("health.title")}</SubHeading>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mb-5">
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("health.cfg.savingsTarget")}</span>
            <NumInput value={health.savingsTarget ?? DEFAULT_SAVINGS_TARGET} onCommit={(v) => actions.setHealth({ savingsTarget: v })} suffix="%" />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("health.cfg.maxDebtRatio")}</span>
            <NumInput value={health.maxDebtRatio ?? DEFAULT_MAX_DEBT_RATIO} onCommit={(v) => actions.setHealth({ maxDebtRatio: v })} suffix="%" />
          </label>
        </div>
        <div className="eyebrow mb-2.5">{t("health.cfg.weights")}</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {HEALTH_DIMS.map((dim) => (
            <label key={dim} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">{t(`health.dim.${dim}`)}</span>
              <NumInput
                value={health.weights?.[dim] ?? DEFAULT_HEALTH_WEIGHTS[dim]}
                onCommit={(v) => actions.setHealthWeight(dim, v)}
                className="w-20"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
