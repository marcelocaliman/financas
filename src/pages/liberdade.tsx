import { useTranslation } from "react-i18next";
import { Sparkles, Flame, CheckCircle2, Circle, HeartPulse, Check, HandCoins } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useLiberdade, type Milestone } from "@/hooks/use-liberdade";
import { useHealth, type HealthDimView } from "@/hooks/use-health";
import { useSettings } from "@/hooks/use-settings";
import { actions } from "@/data/actions";
import { convert } from "@/money/currency";
import { prevMonth } from "@/finance/liberdade";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { ProgressRing } from "@/components/common/progress-ring";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { cn } from "@/lib/utils";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Formata "AAAA-MM" → "mmm de AAAA" no idioma corrente (rótulo da data de chegada). */
function monthLabel(ym: string, lang: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(lang, { month: "short", year: "numeric" });
}

export default function Liberdade() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const numbersHidden = useUI((s) => s.numbersHidden);
  const v = useLiberdade();

  if (!v) return <div className="h-64 rounded-[16px] bg-card border border-border animate-pulse" />;

  // Sem custo de vida → a métrica não faz sentido: convida a preencher.
  if (!v.ready) {
    return (
      <Tile className="p-6 md:p-7">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent shrink-0" />
          <Eyebrow>{t("liberdade.eyebrow")}</Eyebrow>
        </div>
        <p className="mt-3 text-[13.5px] text-muted max-w-md">{t("liberdade.empty")}</p>
      </Tile>
    );
  }

  const mult = v.withdrawalRate > 0 ? 100 / v.withdrawalRate : 0;
  const multLabel = mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1);
  const pctRounded = Math.round(v.freedomPct);

  return (
    <div className="space-y-6">
      {/* Métrica principal: anel + % + número da independência + chegada */}
      <Tile className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-x-9 gap-y-6">
          <ProgressRing pct={v.freedomPct} size={132} stroke={10}>
            <div className="text-center leading-none">
              <div className="text-[clamp(1.5rem,4.5vw,2.1rem)] font-semibold tracking-[-0.03em] tabular">
                <Hidden>{pctRounded}%</Hidden>
              </div>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-accent shrink-0" />
              <Eyebrow>{t("liberdade.eyebrow")}</Eyebrow>
            </div>
            <h3 className="mt-2.5 text-[clamp(1.4rem,3.2vw,2rem)] font-semibold tracking-[-0.035em] leading-tight">
              {v.reached
                ? t("liberdade.headlineReached")
                : numbersHidden
                  ? t("liberdade.headlineHidden")
                  : t("liberdade.headline", { pct: pctRounded })}
            </h3>
            <p className="mt-2.5 text-[13px] text-muted">
              {t("liberdade.independenceNumber")}:{" "}
              <span className="text-text font-medium tabular"><Money value={v.independenceNumber} currency={disp} /></span>{" "}
              <span className="text-faint">· {t("liberdade.subtitle", { mult: multLabel })}</span>
            </p>
          </div>

          {/* Chegada estimada */}
          <div className="text-right shrink-0">
            <Eyebrow className="mb-1.5">{t("liberdade.arrival")}</Eyebrow>
            {v.reached ? (
              <div className="text-[clamp(1.2rem,3vw,1.6rem)] font-semibold text-accent leading-none">{t("liberdade.reached")}</div>
            ) : v.arrival == null ? (
              <div className="text-[clamp(1.2rem,3vw,1.6rem)] font-semibold text-faint leading-none">—</div>
            ) : (
              <>
                <div className="text-[clamp(1.2rem,3vw,1.6rem)] font-semibold tabular leading-none capitalize">{monthLabel(v.arrival.label, lang)}</div>
                <span className="text-[11.5px] text-faint">{t("liberdade.arrivalHint")}</span>
              </>
            )}
          </div>
        </div>

        {/* Barra visual (capada em 100) */}
        <div className="mt-7 h-2.5 rounded-full bg-bg2 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ width: `${Math.min(100, Math.max(v.freedomPct > 0 ? 2 : 0, v.freedomPct))}%` }}
          />
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 mt-7">
          <Stat label={t("liberdade.eligible")} value={<Money value={v.eligibleWealth} currency={disp} />} />
          <Stat
            label={t("liberdade.yearsCovered")}
            value={v.yearsOfFreedom == null ? "—" : <Hidden>{t("liberdade.yearsValue", { n: v.yearsOfFreedom.toFixed(1) })}</Hidden>}
          />
          <Stat
            label={t("liberdade.passive")}
            value={<><Money value={v.safeMonthly} currency={disp} /><span className="text-faint">/{t("liberdade.mo")}</span></>}
            sub={<Hidden>{t("liberdade.covers", { pct: Math.round(v.coverage) })}</Hidden>}
            subTone={v.coverage >= 100 ? "accent" : undefined}
          />
          <Stat
            label={t("liberdade.remaining")}
            value={v.reached ? t("liberdade.reached") : <Money value={v.remaining} currency={disp} />}
          />
        </div>
      </Tile>

      {/* Constância + Compromisso + Marcos + Saúde */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <StreakCard current={v.streak.current} record={v.streak.record} />
        <CompromissoCard />
        <MilestonesCard milestones={v.milestones} />
        <HealthCard />
      </div>
    </div>
  );
}

function gradeKey(score: number): string {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "weak";
}

function HealthCard() {
  const { t } = useTranslation();
  const h = useHealth();
  if (!h) return <div className="rounded-[16px] bg-card border border-border h-44 animate-pulse" />;
  return (
    <Tile className="p-6">
      <div className="flex items-center gap-2">
        <HeartPulse size={15} className="text-accent shrink-0" />
        <Eyebrow>{t("health.title")}</Eyebrow>
      </div>
      {h.score == null ? (
        <p className="mt-3 text-[12.5px] text-muted leading-relaxed">{t("health.empty")}</p>
      ) : (
        <>
          <div className="flex items-end gap-3 mt-3">
            <div className="text-[clamp(2.2rem,6vw,3rem)] font-semibold tabular leading-none">
              <Hidden>{Math.round(h.score)}</Hidden>
            </div>
            <span className="text-[12.5px] text-faint mb-1">/ 100 · {t(`health.grade.${gradeKey(h.score)}`)}</span>
          </div>
          <div className="mt-5 space-y-3">
            {h.dims.map((d) => (
              <HealthBar key={d.dim} dim={d} />
            ))}
          </div>
          <p className="mt-5 text-[11px] text-faint leading-relaxed">{t("health.hint")}</p>
        </>
      )}
    </Tile>
  );
}

function HealthBar({ dim }: { dim: HealthDimView }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1.5">
        <span className="text-muted">{t(`health.dim.${dim.dim}`)}</span>
        {dim.value == null ? <span className="text-faint text-[11px]">{t("health.noData")}</span> : null}
      </div>
      <div className="h-1.5 rounded-full bg-bg2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.round((dim.value ?? 0) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function CompromissoCard() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const settings = useSettings();
  const cfg = settings.compromisso ?? {};
  const monthly = cfg.monthly ?? 0;
  const checkins = cfg.checkins ?? {};
  const cur = thisMonth();
  const done = checkins[cur] === true;
  const monthlyDisp = convert(monthly, base, disp, rates);

  // Últimos 6 meses (mais antigo → atual) p/ a trilha de check-ins.
  const recent: string[] = [];
  let m = cur;
  for (let i = 0; i < 6; i++) {
    recent.unshift(m);
    m = prevMonth(m);
  }
  const decided = recent.filter((mm) => checkins[mm] !== undefined);
  const kept = recent.filter((mm) => checkins[mm] === true).length;

  return (
    <Tile className="p-6">
      <div className="flex items-center gap-2">
        <HandCoins size={15} className={cn("shrink-0", done ? "text-accent" : "text-faint")} />
        <Eyebrow>{t("compromisso.title")}</Eyebrow>
      </div>

      {monthly <= 0 ? (
        <p className="mt-3 text-[12.5px] text-muted leading-relaxed">{t("compromisso.empty")}</p>
      ) : (
        <>
          <p className="mt-3 text-[13px] text-muted">
            {t("compromisso.planned")}:{" "}
            <span className="text-text font-medium tabular"><Money value={monthlyDisp} currency={disp} /></span>
            <span className="text-faint">/{t("liberdade.mo")}</span>
          </p>

          <button
            type="button"
            onClick={() => void actions.setCheckin(cur, !done)}
            aria-pressed={done}
            className={cn(
              "mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              done ? "bg-accent text-[#0A0B0D] border-accent" : "border-border text-muted hover:text-text hover:bg-card-hover",
            )}
          >
            <Check size={15} /> {done ? t("compromisso.kept") : t("compromisso.markKept")}
          </button>

          <div className="mt-5 flex items-center gap-2">
            {recent.map((mm) => {
              const st = checkins[mm];
              return (
                <span
                  key={mm}
                  title={mm}
                  className={cn(
                    "w-3 h-3 rounded-full shrink-0",
                    st === true ? "bg-accent" : st === false ? "bg-[var(--neg)]/60" : "border border-border",
                  )}
                />
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-faint">
            {t("compromisso.adherence", { n: kept, total: Math.max(decided.length, 1) })}
          </p>
        </>
      )}
    </Tile>
  );
}

function Stat({ label, value, sub, subTone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; subTone?: "accent" }) {
  return (
    <div className="min-w-0">
      <span className="eyebrow block mb-1">{label}</span>
      <div className="text-[15px] font-semibold tabular truncate">{value}</div>
      {sub ? <span className={cn("text-[11px]", subTone === "accent" ? "text-accent" : "text-faint")}>{sub}</span> : null}
    </div>
  );
}

function StreakCard({ current, record }: { current: number; record: number }) {
  const { t } = useTranslation();
  return (
    <Tile className="p-6">
      <div className="flex items-center gap-2">
        <Flame size={15} className={cn("shrink-0", current > 0 ? "text-accent" : "text-faint")} />
        <Eyebrow>{t("liberdade.streakTitle")}</Eyebrow>
      </div>
      <div className="flex items-end gap-9 mt-4">
        <div>
          <div className="text-[clamp(2rem,5vw,2.8rem)] font-semibold tabular leading-none text-accent">{current}</div>
          <span className="eyebrow block mt-2">{t("liberdade.streakCurrent")}</span>
        </div>
        <div>
          <div className="text-[clamp(1.4rem,3.5vw,1.9rem)] font-semibold tabular leading-none">{record}</div>
          <span className="eyebrow block mt-2">{t("liberdade.streakRecord")}</span>
        </div>
      </div>
      <p className="mt-5 text-[11.5px] text-faint leading-relaxed">
        {current > 0 ? t("liberdade.streakHint") : t("liberdade.streakEmpty")}
      </p>
    </Tile>
  );
}

function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  // Próximo marco não conquistado (pra dar foco), já conquistados acesos.
  const firstPendingIdx = milestones.findIndex((m) => !m.achieved);
  const label = (m: Milestone): React.ReactNode => {
    if (m.kind === "freedom") return t("liberdade.milestoneFreedom", { pct: m.value });
    if (m.kind === "reserve") return t("liberdade.milestoneReserve");
    return <Money value={m.value} currency={disp} />;
  };
  return (
    <Tile className="p-6">
      <Eyebrow>{t("liberdade.milestonesTitle")}</Eyebrow>
      <ul className="mt-4 space-y-2.5">
        {milestones.map((m, i) => {
          const isNext = i === firstPendingIdx;
          return (
            <li key={`${m.kind}-${m.value}-${i}`} className="flex items-center gap-3">
              {m.achieved ? (
                <CheckCircle2 size={16} className="text-accent shrink-0" />
              ) : (
                <Circle size={16} className={cn("shrink-0", isNext ? "text-muted" : "text-faint")} />
              )}
              <span
                className={cn(
                  "text-[13.5px] tabular",
                  m.achieved ? "text-text font-medium" : isNext ? "text-text" : "text-faint",
                )}
              >
                {label(m)}
              </span>
              {isNext ? <span className="eyebrow ml-auto">{t("liberdade.milestoneNext")}</span> : null}
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}

/** KPIs do cabeçalho do accordion da Liberdade. */
export function LiberdadeSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const v = useLiberdade();
  if (!v || !v.ready) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("liberdade.short")} tone="accent" value={`${Math.round(v.freedomPct)}%`} />
      {v.yearsOfFreedom != null ? (
        <HeaderKpi secondary label={t("liberdade.yearsCovered")} value={t("liberdade.yearsValue", { n: v.yearsOfFreedom.toFixed(1) })} />
      ) : null}
      <HeaderKpi secondary label={t("liberdade.independenceNumber")} value={<Money value={v.independenceNumber} currency={disp} />} />
    </HeaderKpis>
  );
}
