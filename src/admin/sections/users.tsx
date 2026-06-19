import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Trash2, ShieldCheck, Mail, Clock } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { fmtInt, fmtDate, fmtAgo, fmtBytes } from "../format";
import type { UserRow, UserSort } from "../types";
import { AdminCard, StateBlock, Badge } from "../components";
import { Eyebrow } from "@/components/common/tile";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
import { cn } from "@/lib/utils";

const PAGE = 25;

/** Gestão de usuários: busca, ordenação, paginação, detalhe e exclusão (LGPD). */
export function UsersSection() {
  const [raw, setRaw] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<UserSort>("recent");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<UserRow | null>(null);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(raw.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [raw]);

  const { data, error, loading, reload } = useAsync(
    () => adminApi.usersList(search || null, PAGE, page * PAGE, sort),
    [search, sort, page],
  );

  const total = data?.[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Buscar por e-mail…"
            className="w-full h-10 pl-9 pr-3 rounded-[10px] border border-border bg-card2 text-[13.5px] outline-none focus:border-accent transition-colors placeholder:text-faint"
          />
        </div>
        <div className="flex gap-1.5">
          {(["recent", "active", "email"] as UserSort[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSort(s); setPage(0); }}
              className={cn(
                "h-10 px-3 rounded-[10px] text-[12.5px] font-medium border transition-colors",
                sort === s ? "bg-accent text-[#0A0B0D] border-accent" : "border-border text-muted hover:text-text",
              )}
            >
              {s === "recent" ? "Recentes" : s === "active" ? "Ativos" : "A–Z"}
            </button>
          ))}
        </div>
      </div>

      <AdminCard className="!p-0 overflow-hidden">
        <StateBlock loading={loading} error={error} empty={!loading && (data?.length ?? 0) === 0}>
          {/* cabeçalho */}
          <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px_40px] gap-3 px-5 py-3 border-b border-border">
            <Eyebrow>Usuário</Eyebrow>
            <Eyebrow>Cadastro</Eyebrow>
            <Eyebrow>Último acesso</Eyebrow>
            <Eyebrow>Sync</Eyebrow>
            <span />
          </div>
          <div className="divide-y divide-border">
            {data?.map((u) => (
              <button
                key={u.user_id}
                type="button"
                onClick={() => setDetail(u)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-[1fr_140px_140px_120px_40px] gap-1 md:gap-3 px-5 py-3 hover:bg-card-hover transition-colors items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-medium truncate">{u.email}</span>
                    {u.is_admin ? <Badge tone="accent"><ShieldCheck size={10} /> admin</Badge> : null}
                    {u.email_confirmed_at ? null : <Badge tone="neg">não confirmado</Badge>}
                    {u.opted_in ? <Badge><Mail size={10} /> opt-in</Badge> : null}
                  </div>
                </div>
                <div className="text-[12.5px] text-muted tabular">{fmtDate(u.created_at)}</div>
                <div className="text-[12.5px] text-muted tabular flex items-center gap-1">
                  <Clock size={11} className="text-faint md:hidden" />{fmtAgo(u.last_seen_at)}
                </div>
                <div className="text-[12.5px] text-muted tabular">
                  {u.vault_version != null ? `v${u.vault_version} · ${fmtBytes(u.ciphertext_bytes)}` : "—"}
                </div>
                <div className="hidden md:flex justify-end">
                  <ChevronRight size={16} className="text-faint" />
                </div>
              </button>
            ))}
          </div>
        </StateBlock>
      </AdminCard>

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-faint tabular">
          {total} usuário(s) · página {page + 1} de {pages}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="grid place-items-center w-9 h-9 rounded-[9px] border border-border text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="grid place-items-center w-9 h-9 rounded-[9px] border border-border text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <UserDetailDialog
        row={detail}
        onClose={() => setDetail(null)}
        onDeleted={() => { setDetail(null); reload(); }}
      />
    </div>
  );
}

function UserDetailDialog({ row, onClose, onDeleted }: { row: UserRow | null; onClose: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!row) { setConfirm(false); setErr(""); }
  }, [row]);

  const doDelete = async () => {
    if (!row) return;
    setBusy(true);
    setErr("");
    try {
      await adminApi.deleteUser(row.user_id, row.email);
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!row} onClose={onClose} title={row?.email ?? ""} wide>
      {row ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Cadastro" value={fmtDate(row.created_at)} />
            <Field label="Último acesso" value={fmtAgo(row.last_seen_at)} />
            <Field label="Último login" value={fmtAgo(row.last_sign_in_at)} />
            <Field label="E-mail confirmado" value={row.email_confirmed_at ? fmtDate(row.email_confirmed_at) : "Não"} />
            <Field label="Opt-in e-mail" value={row.opted_in ? "Sim" : "Não"} />
            <Field label="Versão do cofre" value={row.vault_version != null ? `v${row.vault_version}` : "Sem cofre"} />
            <Field label="Tamanho (cifrado)" value={fmtBytes(row.ciphertext_bytes)} />
          </div>

          <div className="rounded-[10px] border border-border bg-card2 px-3.5 py-2.5 text-[11.5px] text-faint leading-relaxed">
            O conteúdo financeiro é cifrado ponta-a-ponta. Nem o servidor nem o admin conseguem lê-lo —
            só estes metadados.
          </div>

          {err ? <p className="text-[12px] text-neg">{err}</p> : null}

          <div className="border-t border-border pt-4">
            {!confirm ? (
              <Button variant="danger" onClick={() => setConfirm(true)} disabled={row.is_admin}>
                <Trash2 size={14} className="mr-1.5" />
                {row.is_admin ? "Admin não pode ser excluído" : "Excluir conta (LGPD)"}
              </Button>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[12.5px] text-muted leading-relaxed">
                  Apaga a conta e <b className="text-text">todos os dados</b> (cofre, blobs, opt-in) de forma
                  irreversível. Confirmar?
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" onClick={() => void doDelete()} disabled={busy}>
                    {busy ? "Excluindo…" : "Confirmar exclusão"}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="text-[13px] text-text tabular mt-1">{value}</div>
    </div>
  );
}

/** Resumo p/ o cabeçalho do accordion. */
export function UsersSummary() {
  const { data } = useAsync(() => adminApi.overview(), []);
  if (!data) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label="contas" value={fmtInt(data.total_users)} raw />
      <HeaderKpi secondary label="confirmadas" tone="accent" value={fmtInt(data.confirmed_users)} raw />
      <HeaderKpi secondary label="novas 30d" value={fmtInt(data.new_30d)} raw />
    </HeaderKpis>
  );
}
