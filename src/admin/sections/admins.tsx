import { useState } from "react";
import { ShieldCheck, UserPlus, X } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { fmtInt, fmtDate } from "../format";
import { AdminCard, StateBlock } from "../components";
import { Button } from "@/components/common/button";

/** Equipe de administradores: lista, concede e retira (nunca remove o último). */
export function AdminsSection() {
  const { data, error, loading, reload } = useAsync(() => adminApi.adminsList(), []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const errLabel = (e: string): string => {
    if (/user_not_found/.test(e)) return "Nenhuma conta com esse e-mail.";
    if (/cannot_remove_last_admin/.test(e)) return "Não dá para remover o último admin.";
    if (/not_authorized/.test(e)) return "Sem permissão.";
    return e;
  };

  const grant = async () => {
    const v = email.trim();
    if (!v) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.setRole(v, true);
      setEmail("");
      setMsg({ kind: "ok", text: `${v} agora é admin.` });
      reload();
    } catch (e) {
      setMsg({ kind: "err", text: errLabel(e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (e: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.setRole(e, false);
      reload();
    } catch (err) {
      setMsg({ kind: "err", text: errLabel(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminCard title="Conceder acesso de admin">
        <div className="flex flex-wrap gap-2.5">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void grant(); }}
            type="email"
            placeholder="e-mail da conta…"
            className="flex-1 min-w-[200px] h-10 px-3.5 rounded-[10px] border border-border bg-card2 text-[13.5px] outline-none focus:border-accent transition-colors placeholder:text-faint"
          />
          <Button onClick={() => void grant()} disabled={busy || !email.trim()}>
            <UserPlus size={15} className="mr-1.5" /> Tornar admin
          </Button>
        </div>
        <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
          A conta precisa já existir. O admin só vê metadados — nunca o dado financeiro cifrado.
        </p>
        {msg ? (
          <p className={msg.kind === "ok" ? "text-[12px] text-accent mt-2.5" : "text-[12px] text-neg mt-2.5"}>{msg.text}</p>
        ) : null}
      </AdminCard>

      <AdminCard title="Administradores">
        <StateBlock loading={loading} error={error}>
          <div className="divide-y divide-border -my-1">
            {data?.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-accent-soft text-accent shrink-0">
                    <ShieldCheck size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{a.email}</div>
                    <div className="text-[11px] text-faint">desde {fmtDate(a.created_at)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void revoke(a.email)}
                  disabled={busy || (data?.length ?? 0) <= 1}
                  title={(data?.length ?? 0) <= 1 ? "Não dá para remover o último admin" : "Remover admin"}
                  className="grid place-items-center w-8 h-8 rounded-[9px] text-faint hover:text-neg hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </StateBlock>
      </AdminCard>
    </div>
  );
}

/** Resumo p/ o cabeçalho do accordion. */
export function AdminsSummary() {
  const { data } = useAsync(() => adminApi.adminsList(), []);
  if (!data) return null;
  return (
    <span className="hidden md:block text-[12.5px] text-muted tabular">
      {fmtInt(data.length)} {data.length === 1 ? "administrador" : "administradores"}
    </span>
  );
}
