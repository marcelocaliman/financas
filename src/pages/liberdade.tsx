import { useTranslation } from "react-i18next";
import { Sparkles, Flame, CheckCircle2, Circle, HeartPulse } from "lucide-react";
import { useUI } from "@/store/ui";
import { useLiberdade, type Milestone } from "@/hooks/use-liberdade";
import { useHealth, type HealthDimView } from "@/hooks/use-health";
import { Tile, Eyebrow } from "@/components/common/tile";
import { CardSubNav } from "@/components/common/card-sub-nav";
import { Money } from "@/components/common/money";
import { formatMoney } from "@/money/currency";
import { Hidden } from "@/components/common/hidden";
import { ProgressRing } from "@/components/common/progress-ring";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { cn } from "@/lib/utils";

/** Formata "AAAA-MM" → "mmm de AAAA" no idioma corrente (rótulo da data de chegada). */
function monthLabel(ym: string, lang: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(lang, { month: "short", year: "numeric" });
}

/** Cards da aba Liberdade (âncoras + rótulos da sub-nav sticky). Constância/Marcos ficam lado a
 *  lado no desktop (mesma linha) — as duas abas pulam pra lá; no mobile empilham e funcionam full. */
const SUBNAV: { id: string; key: string }[] = [
  { id: "lib-independencia", key: "liberdade.tabIndependence" },
  { id: "lib-constancia", key: "liberdade.streakTitle" },
  { id: "lib-marcos", key: "liberdade.milestonesTitle" },
  { id: "lib-saude", key: "liberdade.tabHealth" },
];

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
      <Tile className="p-4 sm:p-6 md:p-7">
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
      <CardSubNav items={SUBNAV.map((s) => ({ id: s.id, label: t(s.key) }))} />
      {/* Métrica principal: anel + % + número da independência + chegada */}
      <div id="lib-independencia">
      <Tile className="p-4 sm:p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-9 sm:gap-y-6">
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
            {v.coveredByPassive ? (
              <p className="mt-2.5 text-[13px] text-muted">{t("liberdade.coveredByPassive")}</p>
            ) : (
              <p className="mt-2.5 text-[13px] text-muted">
                {t("liberdade.independenceNumber")}:{" "}
                <span className="text-text font-medium tabular"><Money value={v.independenceNumber} currency={disp} /></span>{" "}
                <span className="text-faint">· {t("liberdade.subtitle", { mult: multLabel })}</span>
                {v.passiveAnnual > 0 ? <span className="text-faint"> · {t("liberdade.netsPassive")}</span> : null}
              </p>
            )}
          </div>

          {/* Chegada estimada */}
          <div className="text-left sm:text-right shrink-0">
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
            sub={
              <Hidden>
                <span className="block">{t("liberdade.covers", { pct: Math.round(v.coverage) })}</span>
                {v.rentMonthly > 0 ? (
                  <span className="block text-faint">
                    {t("fire.passiveBreakdown", { portfolio: formatMoney(v.portfolioMonthly, disp), rent: formatMoney(v.rentMonthly, disp) })}
                  </span>
                ) : null}
              </Hidden>
            }
            subTone={v.coverage >= 100 ? "accent" : undefined}
          />
          <Stat
            label={t("liberdade.remaining")}
            value={v.reached ? t("liberdade.reached") : <Money value={v.remaining} currency={disp} />}
          />
        </div>
      </Tile>
      </div>

      {/* Constância + Marcos lado a lado (mesma altura); Saúde ocupa a largura toda embaixo. */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* wrappers com `grid` pra o card interno esticar até a altura da linha (mantém par de mesma altura) */}
        <div id="lib-constancia" className="grid"><StreakCard current={v.streak.current} record={v.streak.record} /></div>
        <div id="lib-marcos" className="grid"><MilestonesCard milestones={v.milestones} /></div>
        <div id="lib-saude" className="grid lg:col-span-2"><HealthCard /></div>
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

function HealthCard({ className }: { className?: string }) {
  const { t } = useTranslation();
  const h = useHealth();
  if (!h) return <div className={cn("rounded-[16px] bg-card border border-border h-44 animate-pulse", className)} />;
  return (
    <Tile className={cn("p-6", className)}>
      <div className="flex items-center gap-2">
        <HeartPulse size={15} className="text-accent shrink-0" />
        <Eyebrow>{t("health.title")}</Eyebrow>
      </div>
      {h.score == null ? (
        <p className="mt-3 text-[12.5px] text-muted leading-relaxed">{t("health.empty")}</p>
      ) : (
        <>
          {/* Largura cheia: a nota à esquerda e as 5 dimensões em 2 colunas à direita. */}
          <div className="mt-3 grid gap-x-12 gap-y-5 items-center lg:grid-cols-[auto_1fr]">
            <div className="flex items-end gap-3">
              <div className="text-[clamp(2.4rem,6vw,3.2rem)] font-semibold tabular leading-none">
                <Hidden>{Math.round(h.score)}</Hidden>
              </div>
              <span className="text-[12.5px] text-faint mb-1">/ 100 · {t(`health.grade.${gradeKey(h.score)}`)}</span>
            </div>
            <div className="grid gap-x-12 gap-y-3.5 sm:grid-cols-2">
              {h.dims.map((d) => (
                <HealthBar key={d.dim} dim={d} />
              ))}
            </div>
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
    <Tile className="p-6 flex flex-col">
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
      <p className="mt-auto pt-5 text-[11.5px] text-faint leading-relaxed">
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
    if (m.kind === "reserve") return t("liberdade.milestoneReserve");
    return (
      <>
        <Money value={m.value} currency={disp} />
        {m.pct != null ? (
          <span className="text-faint font-normal"> · {t("liberdade.milestoneFreedom", { pct: m.pct })}</span>
        ) : null}
      </>
    );
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
