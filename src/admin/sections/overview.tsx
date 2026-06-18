import { TrendingUp, Users, UserCheck, Activity, Moon, CloudUpload, Mail, Database } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { useOnlineCount } from "../use-realtime";
import { fmtInt, fmtBytes } from "../format";
import { AdminCard, Stat, BarsChart, StateBlock, OnlineCard } from "../components";
import { Eyebrow } from "@/components/common/tile";

/** Visão geral: KPIs de base de usuários, atividade, churn, sync e cadastros no tempo. */
export function OverviewSection({ days }: { days: number }) {
  const ov = useAsync(() => adminApi.overview(), [], { refreshMs: 20000 });
  const su = useAsync(() => adminApi.signupsDaily(days), [days], { refreshMs: 20000 });
  const online = useOnlineCount();

  const o = ov.data;
  const total = o?.total_users ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="space-y-6">
      <OnlineCard count={online} />
      <StateBlock loading={ov.loading} error={ov.error}>
        {o ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Stat label={<><Users size={11} className="inline mr-1 -mt-0.5" />Usuários</>} value={fmtInt(o.total_users)} sub={`${fmtInt(o.new_30d)} novos em 30d`} />
              <Stat label={<><UserCheck size={11} className="inline mr-1 -mt-0.5" />Confirmados</>} value={fmtInt(o.confirmed_users)} sub={`${pct(o.confirmed_users)}% da base`} tone="accent" />
              <Stat label={<><Activity size={11} className="inline mr-1 -mt-0.5" />Ativos 7d</>} value={fmtInt(o.active_7d)} sub={`${pct(o.active_7d)}% · 30d: ${fmtInt(o.active_30d)}`} />
              <Stat label={<><TrendingUp size={11} className="inline mr-1 -mt-0.5" />Novos 7d</>} value={fmtInt(o.new_7d)} sub="cadastros na semana" />
              <Stat label={<><Moon size={11} className="inline mr-1 -mt-0.5" />Dormentes 30d</>} value={fmtInt(o.dormant_30d)} sub={`${pct(o.dormant_30d)}% sem login`} tone={o.dormant_30d > 0 ? "neg" : "text"} />
              <Stat label="Dormentes 90d" value={fmtInt(o.dormant_90d)} sub="sem login há 3 meses" tone={o.dormant_90d > 0 ? "neg" : "text"} />
              <Stat label={<><CloudUpload size={11} className="inline mr-1 -mt-0.5" />Com sync</>} value={fmtInt(o.synced_users)} sub={`${fmtInt(o.vault_users)} cofres criados`} />
              <Stat label={<><Mail size={11} className="inline mr-1 -mt-0.5" />Opt-in e-mail</>} value={fmtInt(o.optin_count)} sub={`${pct(o.optin_count)}% consentiram`} />
            </div>

            <AdminCard title={<><Database size={11} className="inline mr-1 -mt-0.5" />Armazenamento (cifrado)</>} className="mt-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                <div>
                  <div className="font-numeric font-semibold tabular text-[22px] tracking-[-0.02em]">{fmtBytes(o.total_ciphertext_bytes)}</div>
                  <div className="text-[11.5px] text-faint mt-1">total de blobs cifrados</div>
                </div>
                <div>
                  <div className="font-numeric font-semibold tabular text-[22px] tracking-[-0.02em]">{fmtBytes(o.avg_ciphertext_bytes)}</div>
                  <div className="text-[11.5px] text-faint mt-1">média por usuário</div>
                </div>
                <div>
                  <div className="font-numeric font-semibold tabular text-[22px] tracking-[-0.02em]">{fmtInt(o.admins_count)}</div>
                  <div className="text-[11.5px] text-faint mt-1">administradores</div>
                </div>
              </div>
              <p className="text-[11px] text-faint mt-4 leading-relaxed">
                Só o <b className="text-muted">tamanho</b> do blob é visível — o conteúdo é cifrado ponta-a-ponta e
                ilegível para o servidor e para o admin.
              </p>
            </AdminCard>
          </>
        ) : null}
      </StateBlock>

      <AdminCard title="Cadastros por dia">
        <StateBlock loading={su.loading} error={su.error}>
          {su.data ? (
            <>
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-numeric font-semibold tabular text-[24px] tracking-[-0.02em]">
                  {fmtInt(su.data.reduce((s, d) => s + d.signups, 0))}
                </span>
                <span className="text-[12px] text-faint">novos cadastros em {days} dias</span>
              </div>
              <BarsChart data={su.data.map((d) => ({ label: d.day, value: d.signups, title: `${d.day}: ${d.signups} cadastro(s)` }))} height={130} />
              <div className="flex items-center justify-between mt-2">
                <Eyebrow>{su.data[0]?.day.slice(5)}</Eyebrow>
                <Eyebrow>{su.data.at(-1)?.day.slice(5)}</Eyebrow>
              </div>
            </>
          ) : null}
        </StateBlock>
      </AdminCard>
    </div>
  );
}

/** Resumo p/ o cabeçalho do accordion — online ao vivo + base de usuários. */
export function OverviewSummary() {
  const ov = useAsync(() => adminApi.overview(), [], { refreshMs: 30000 });
  const online = useOnlineCount();
  if (!ov.data) return null;
  return (
    <span className="hidden md:flex items-center gap-2 text-[12.5px] text-muted tabular">
      <span className="inline-flex items-center gap-1.5 text-accent font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />{fmtInt(online)} online
      </span>
      <span className="text-faint">·</span>
      {fmtInt(ov.data.total_users)} usuários · {fmtInt(ov.data.active_7d)} ativos 7d
    </span>
  );
}
