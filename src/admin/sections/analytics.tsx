import { Eye, MousePointerClick, UserPlus, LogIn, Smartphone } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { fmtInt } from "../format";
import { AdminCard, Stat, BarsChart, StateBlock } from "../components";
import { Eyebrow } from "@/components/common/tile";

/** Analytics próprio (privacy-first): funil landing → cadastro → app, séries e top eventos. */
export function AnalyticsSection({ days }: { days: number }) {
  const ov = useAsync(() => adminApi.analyticsOverview(days), [days]);
  const daily = useAsync(() => adminApi.eventsDaily(days), [days]);
  const top = useAsync(() => adminApi.topEvents(days), [days]);

  return (
    <div className="space-y-6">
      <StateBlock loading={ov.loading} error={ov.error}>
        {ov.data ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Stat label={<><Eye size={11} className="inline mr-1 -mt-0.5" />Visitas (landing)</>} value={fmtInt(ov.data.landing_views)} sub={`${fmtInt(ov.data.unique_visitors)} visitantes únicos`} />
              <Stat label={<><MousePointerClick size={11} className="inline mr-1 -mt-0.5" />Cliques CTA</>} value={fmtInt(ov.data.cta_clicks)} />
              <Stat label={<><UserPlus size={11} className="inline mr-1 -mt-0.5" />Cadastros</>} value={fmtInt(ov.data.signups)} tone="accent" />
              <Stat label={<><LogIn size={11} className="inline mr-1 -mt-0.5" />Logins</>} value={fmtInt(ov.data.logins)} />
              <Stat label={<><Smartphone size={11} className="inline mr-1 -mt-0.5" />Aberturas do app</>} value={fmtInt(ov.data.app_opens)} />
            </div>

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
                Conversão visita → cadastro:{" "}
                <b className="text-accent tabular">{ov.data.conversion_pct}%</b>
              </p>
            </AdminCard>
          </>
        ) : null}
      </StateBlock>

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

      <AdminCard title="Eventos mais frequentes">
        <StateBlock loading={top.loading} error={top.error} empty={!top.loading && (top.data?.length ?? 0) === 0}>
          <div className="divide-y divide-border -my-1">
            {top.data?.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-faint w-5">{i + 1}</span>
                  <span className="text-[13px] font-medium">{e.name}</span>
                  <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint">{e.surface}</span>
                </div>
                <span className="font-numeric font-semibold tabular text-[14px]">{fmtInt(e.count)}</span>
              </div>
            ))}
          </div>
        </StateBlock>
      </AdminCard>

      <p className="text-[11px] text-faint leading-relaxed">
        Analytics de 1ª-parte, sem cookie e sem identificar a pessoa: só eventos não-sensíveis (sem
        nenhum dado financeiro). Os eventos nunca são ligados a uma conta.
      </p>
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
              <div
                className="h-full bg-accent/80 rounded-[8px] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }}
              />
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
