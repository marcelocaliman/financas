import type { ReactNode } from "react";
import { Eye, MousePointerClick, UserPlus, LogIn, Smartphone, Tablet, Monitor, Globe, Radio } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { useOnlinePresence, useLiveEvents } from "../use-realtime";
import { fmtInt, fmtAgo } from "../format";
import { AdminCard, Stat, BarsChart, StateBlock, OnlineCard } from "../components";
import { Eyebrow } from "@/components/common/tile";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { cn } from "@/lib/utils";

const LIVE_MS = 20000;

const EVENT_LABEL: Record<string, string> = {
  landing_view: "Visita à landing",
  cta_click: "Clique no CTA",
  signup: "Cadastro",
  login: "Login",
  app_open: "Abriu o app",
  section_view: "Viu seção",
};

/** "BR" → 🇧🇷 (regional indicator). Vazio se inválido. */
function flag(cc: string | null): string {
  if (!cc || cc.length !== 2 || !/^[A-Za-z]{2}$/.test(cc)) return "🌐";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (cc.toUpperCase().charCodeAt(0) - 65), A + (cc.toUpperCase().charCodeAt(1) - 65));
}

function DeviceIcon({ device, size = 12 }: { device: string | null; size?: number }) {
  if (device === "mobile") return <Smartphone size={size} className="inline" />;
  if (device === "tablet") return <Tablet size={size} className="inline" />;
  if (device === "desktop") return <Monitor size={size} className="inline" />;
  return <Globe size={size} className="inline" />;
}

/** Analytics próprio (privacy-first): AO VIVO (online + feed), funil, séries, país, dispositivo. */
export function AnalyticsSection({ days }: { days: number }) {
  const ov = useAsync(() => adminApi.analyticsOverview(days), [days], { refreshMs: LIVE_MS });
  const daily = useAsync(() => adminApi.eventsDaily(days), [days], { refreshMs: LIVE_MS });
  const top = useAsync(() => adminApi.topEvents(days), [days], { refreshMs: LIVE_MS });
  const country = useAsync(() => adminApi.eventsByCountry(days), [days], { refreshMs: LIVE_MS });
  const device = useAsync(() => adminApi.eventsByDevice(days), [days], { refreshMs: LIVE_MS });

  return (
    <div className="space-y-6">
      {/* ── AO VIVO ───────────────────────────────────────────────── */}
      <LiveCard />

      {/* ── Funil / KPIs ──────────────────────────────────────────── */}
      <StateBlock loading={ov.loading} error={ov.error}>
        {ov.data ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Stat label={<><Eye size={11} className="inline mr-1 -mt-0.5" />Visitas (landing)</>} value={fmtInt(ov.data.landing_views)} sub="acessos (com repetições)" />
              <Stat label={<><MousePointerClick size={11} className="inline mr-1 -mt-0.5" />Cliques CTA</>} value={fmtInt(ov.data.cta_clicks)} />
              <Stat label={<><UserPlus size={11} className="inline mr-1 -mt-0.5" />Cadastros</>} value={fmtInt(ov.data.signups)} tone="accent" />
              <Stat label={<><LogIn size={11} className="inline mr-1 -mt-0.5" />Logins</>} value={fmtInt(ov.data.logins)} />
              <Stat label={<><Smartphone size={11} className="inline mr-1 -mt-0.5" />Aberturas do app</>} value={fmtInt(ov.data.app_opens)} />
            </div>

            <AdminCard title="Visitantes" className="mt-5">
              <div className="flex items-baseline gap-2">
                <span className="font-numeric font-semibold tabular text-[26px] leading-none">{fmtInt(ov.data.unique_visitors)}</span>
                <span className="text-[12px] text-muted">pessoas únicas no período</span>
              </div>
              <SplitBar
                parts={[
                  { label: "Novos", value: ov.data.new_visitors, color: "var(--accent)" },
                  { label: "Recorrentes", value: ov.data.returning_visitors, color: "var(--eur, #8a8f98)" },
                ]}
              />
              <p className="text-[11px] text-faint mt-3 leading-relaxed">
                Cada pessoa conta uma vez (por navegador, sem cookie). <b className="text-muted">Novo</b> = 1ª visita no período; <b className="text-muted">recorrente</b> = já tinha vindo antes.
              </p>
            </AdminCard>

            <AdminCard title="Funil de conversão" className="mt-5">
              <Funnel
                steps={[
                  { label: "Visitas", value: ov.data.landing_views },
                  { label: "Cliques no CTA", value: ov.data.cta_clicks },
                  { label: "Cadastros", value: ov.data.signups },
                  { label: "Abriram o app", value: ov.data.app_opens },
                ]}
              />
              <p className="text-[12px] text-muted mt-4">
                Conversão visita → cadastro: <b className="text-accent tabular">{ov.data.conversion_pct}%</b>
              </p>
            </AdminCard>
          </>
        ) : null}
      </StateBlock>

      {/* ── Séries diárias ────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <AdminCard title="Visitas por dia">
          <StateBlock loading={daily.loading} error={daily.error}>
            {daily.data ? (
              <>
                <BarsChart data={daily.data.map((d) => ({ label: d.day, value: d.landing_views, title: `${d.day}: ${d.landing_views} visita(s)` }))} height={110} />
                <Range data={daily.data.map((d) => d.day)} />
              </>
            ) : null}
          </StateBlock>
        </AdminCard>
        <AdminCard title="Cadastros por dia">
          <StateBlock loading={daily.loading} error={daily.error}>
            {daily.data ? (
              <>
                <BarsChart data={daily.data.map((d) => ({ label: d.day, value: d.signups, title: `${d.day}: ${d.signups} cadastro(s)` }))} height={110} />
                <Range data={daily.data.map((d) => d.day)} />
              </>
            ) : null}
          </StateBlock>
        </AdminCard>
      </div>

      {/* ── País + dispositivo ────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <AdminCard title={<><Globe size={11} className="inline mr-1 -mt-0.5" />Por país</>}>
          <StateBlock loading={country.loading} error={country.error} empty={!country.loading && (country.data?.length ?? 0) === 0}>
            <RankList
              rows={(country.data ?? []).map((c) => ({
                key: c.country,
                label: (
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] leading-none">{flag(c.country === "??" ? null : c.country)}</span>
                    <span>{c.country === "??" ? "Desconhecido" : c.country}</span>
                  </span>
                ),
                count: c.count,
              }))}
            />
          </StateBlock>
        </AdminCard>
        <AdminCard title="Por dispositivo">
          <StateBlock loading={device.loading} error={device.error} empty={!device.loading && (device.data?.length ?? 0) === 0}>
            <RankList
              rows={(device.data ?? []).map((d) => ({
                key: d.device,
                label: (
                  <span className="flex items-center gap-2 capitalize">
                    <DeviceIcon device={d.device} size={14} /> {d.device}
                  </span>
                ),
                count: d.count,
              }))}
            />
          </StateBlock>
        </AdminCard>
      </div>

      {/* ── Top eventos ───────────────────────────────────────────── */}
      <AdminCard title="Eventos mais frequentes">
        <StateBlock loading={top.loading} error={top.error} empty={!top.loading && (top.data?.length ?? 0) === 0}>
          <div className="divide-y divide-border -my-1">
            {top.data?.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-faint w-5">{i + 1}</span>
                  <span className="text-[13px] font-medium">{EVENT_LABEL[e.name] ?? e.name}</span>
                  <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint">{e.surface}</span>
                </div>
                <span className="font-numeric font-semibold tabular text-[14px]">{fmtInt(e.count)}</span>
              </div>
            ))}
          </div>
        </StateBlock>
      </AdminCard>

      <p className="text-[11px] text-faint leading-relaxed">
        Analytics de 1ª-parte, sem cookie e sem identificar a pessoa: só eventos não-sensíveis
        (sem nenhum dado financeiro), país agregado (o IP nunca é armazenado) e tipo de dispositivo.
        Os eventos nunca são ligados a uma conta.
      </p>
    </div>
  );
}

/** AO VIVO: card VERDE com a contagem de online (presença anônima) + feed de eventos. */
function LiveCard() {
  const online = useOnlinePresence();
  const events = useLiveEvents(24);
  return (
    <div className="space-y-4">
      <OnlineCard data={online} />
      <AdminCard title={<span className="flex items-center gap-1.5"><Radio size={11} className="text-accent" /> Atividade recente</span>}>
        <div className="max-h-[240px] overflow-y-auto scrollbar-subtle divide-y divide-border -my-1">
          {events.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-faint">aguardando eventos…</div>
          ) : (
            events.map((e, i) => (
              <div key={`${e.created_at}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", e.surface === "app" ? "bg-accent" : "bg-[var(--eur,#8a8f98)]")} />
                  <span className="text-[12.5px] truncate">{EVENT_LABEL[e.name] ?? e.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-faint text-[11px] tabular">
                  <span title={e.country ?? ""}>{flag(e.country)}</span>
                  <DeviceIcon device={e.device} />
                  <span className="w-[52px] text-right">{fmtAgo(e.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminCard>
    </div>
  );
}

function RankList({ rows }: { rows: { key: string; label: ReactNode; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <div className="w-[130px] shrink-0 text-[12.5px] text-text">{r.label}</div>
          <div className="flex-1 h-5 rounded-[7px] bg-card2 overflow-hidden">
            <div className="h-full bg-accent/70 rounded-[7px] transition-[width] duration-700" style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} />
          </div>
          <span className="w-[44px] text-right text-[12px] font-semibold tabular">{fmtInt(r.count)}</span>
        </div>
      ))}
    </div>
  );
}

/** Barra dividida (stacked) — proporção entre N partes, com legenda. Usada p/ novos × recorrentes. */
function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  return (
    <div className="mt-3.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-card2">
        {parts.map((p, i) => (
          <div
            key={i}
            className="h-full transition-[width] duration-700"
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            title={`${p.label}: ${fmtInt(p.value)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[12.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="text-muted">{p.label}</span>
            <span className="tabular font-semibold text-text">{fmtInt(p.value)}</span>
            <span className="tabular text-faint">({Math.round((p.value / total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-[120px] shrink-0 text-[12.5px] text-muted">{s.label}</span>
            <div className="flex-1 h-7 rounded-[8px] bg-card2 overflow-hidden relative">
              <div className="h-full bg-accent/80 rounded-[8px] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold tabular text-text">{fmtInt(s.value)}</span>
            </div>
            <span className="w-[52px] shrink-0 text-right text-[11.5px] text-faint tabular">{rate != null ? `${rate}%` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function Range({ data }: { data: string[] }) {
  return (
    <div className="flex items-center justify-between mt-2">
      <Eyebrow>{data[0]?.slice(5)}</Eyebrow>
      <Eyebrow>{data.at(-1)?.slice(5)}</Eyebrow>
    </div>
  );
}

/** Resumo p/ o cabeçalho do accordion. */
export function AnalyticsSummary({ days }: { days: number }) {
  const { data } = useAsync(() => adminApi.analyticsOverview(days), [days]);
  if (!data) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label="visitas" value={fmtInt(data.landing_views)} raw />
      <HeaderKpi secondary label="cadastros" tone="accent" value={fmtInt(data.signups)} raw />
      <HeaderKpi secondary label="conversão" tone="accent" value={`${data.conversion_pct}%`} raw />
    </HeaderKpis>
  );
}
