import { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { fmtDateTime } from "../format";
import { AdminCard, StateBlock, Badge } from "../components";
import { Eyebrow } from "@/components/common/tile";

const PAGE = 40;

/** Ação → rótulo legível + tom do badge. */
function actionMeta(action: string | null): { label: string; tone: "muted" | "accent" | "neg" } {
  const a = (action ?? "").toLowerCase();
  if (a.includes("login")) return { label: "Login", tone: "accent" };
  if (a.includes("signup") || a.includes("register")) return { label: "Cadastro", tone: "accent" };
  if (a.includes("logout")) return { label: "Logout", tone: "muted" };
  if (a.includes("recovery") || a.includes("reset")) return { label: "Recuperação", tone: "neg" };
  if (a.includes("token")) return { label: "Token", tone: "muted" };
  if (a.includes("delete")) return { label: "Exclusão", tone: "neg" };
  return { label: action || "—", tone: "muted" };
}

/** Logs de acesso (Supabase Auth): login, cadastro, recuperação, logout… com IP. */
export function AccessLogSection() {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync(() => adminApi.auditLog(PAGE, page * PAGE), [page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-faint">Eventos de autenticação do Supabase (mais recentes primeiro).</span>
        <button
          type="button"
          onClick={reload}
          className="grid place-items-center w-9 h-9 rounded-[9px] border border-border text-muted hover:text-text transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <AdminCard className="!p-0 overflow-hidden">
        <StateBlock loading={loading} error={error} empty={!loading && (data?.length ?? 0) === 0}>
          <div className="hidden sm:grid grid-cols-[120px_1fr_140px] gap-3 px-5 py-3 border-b border-border">
            <Eyebrow>Ação</Eyebrow>
            <Eyebrow>Quando · quem</Eyebrow>
            <Eyebrow>IP</Eyebrow>
          </div>
          <div className="divide-y divide-border">
            {data?.map((e) => {
              const m = actionMeta(e.action);
              return (
                <div key={e.id} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_140px] gap-1 sm:gap-3 px-5 py-2.5 items-center">
                  <div><Badge tone={m.tone}>{m.label}</Badge></div>
                  <div className="min-w-0">
                    <span className="text-[12.5px] tabular text-text">{fmtDateTime(e.created_at)}</span>
                    {e.actor_email ? <span className="text-[12.5px] text-muted ml-2 truncate">{e.actor_email}</span> : null}
                  </div>
                  <div className="text-[12px] text-faint tabular truncate">{e.ip ?? "—"}</div>
                </div>
              );
            })}
          </div>
        </StateBlock>
      </AdminCard>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="grid place-items-center w-9 h-9 rounded-[9px] border border-border text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[12px] text-faint tabular px-2">página {page + 1}</span>
        <button
          type="button"
          disabled={(data?.length ?? 0) < PAGE}
          onClick={() => setPage((p) => p + 1)}
          className="grid place-items-center w-9 h-9 rounded-[9px] border border-border text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
