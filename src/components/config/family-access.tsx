import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Trash2, Loader2, ShieldAlert, Link2, KeyRound, Users } from "lucide-react";
import { useVault } from "@/vault/vault-store";
import { createShare, listShares, revokeShare, type ShareRow } from "@/lib/shares";
import { useIsPro } from "@/hooks/use-pro";
import { ProUpsell } from "@/components/pro/pro-upsell";
import { cn } from "@/lib/utils";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[13.5px] text-text outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)] transition-colors"
    />
  );
}

function Btn({
  tone = "default",
  className,
  ...props
}: { tone?: "default" | "teal" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] text-[13px] font-medium transition-colors disabled:opacity-50",
        tone === "teal"
          ? "bg-accent text-[#0A0B0D] hover:brightness-105"
          : tone === "danger"
            ? "border border-red-400/50 text-red-400 hover:bg-red-500/10"
            : "border border-border text-muted hover:text-text hover:bg-card-hover",
        className,
      )}
    />
  );
}

/** Botão de copiar com feedback transitório (✓). */
function CopyBtn({ text, children, tone }: { text: string; children: React.ReactNode; tone?: "teal" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard indisponível — ignora */
    }
  };
  return (
    <Btn tone={tone} onClick={copy}>
      {done ? <Check size={14} /> : <Copy size={14} />} {children}
    </Btn>
  );
}

/** Mensagem pronta pra mandar no WhatsApp (link + PIN juntos, por conveniência do dono). */
function waMessage(row: ShareRow): string {
  return (
    `Acompanhe nossas finanças (só leitura):\n${row.link}\n\n` +
    `PIN: ${row.pin}\n\n` +
    `Guarde com cuidado — quem tiver o link e o PIN vê todos os números.`
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function ShareCard({ row, onRevoke, highlight }: { row: ShareRow; onRevoke: () => void; highlight: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      className={cn(
        "rounded-[12px] border p-4 space-y-3",
        highlight ? "border-accent/50 bg-accent/[0.05]" : "border-border bg-bg2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-text truncate">{row.label || "Acesso da família"}</div>
          <div className="text-[11.5px] text-faint mt-0.5">
            Criado {fmtDate(row.createdAt)} · Último acesso {fmtDate(row.accessedAt)}
          </div>
        </div>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Revogar acesso"
            className="grid place-items-center w-8 h-8 rounded-[8px] text-faint hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <Trash2 size={15} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <Btn onClick={() => setConfirming(false)}>Cancelar</Btn>
            <Btn tone="danger" onClick={onRevoke}>Revogar</Btn>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-2 min-w-0 rounded-[8px] border border-border bg-card px-2.5 h-9">
          <Link2 size={13} className="text-faint shrink-0" />
          <span className="text-[12px] text-muted font-mono truncate">{row.link}</span>
        </div>
        <CopyBtn text={row.link}>Copiar link</CopyBtn>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-2 rounded-[8px] border border-border bg-card px-2.5 h-9">
          <KeyRound size={13} className="text-faint shrink-0" />
          <span className="text-[15px] text-text font-mono tabular tracking-[0.3em]">{row.pin}</span>
          <span className="text-[11px] text-faint ml-auto">PIN</span>
        </div>
        <CopyBtn text={row.pin}>Copiar PIN</CopyBtn>
      </div>

      <div className="flex flex-wrap gap-2 pt-0.5">
        <CopyBtn text={waMessage(row)} tone="teal">Copiar tudo (mensagem pronta)</CopyBtn>
      </div>
    </div>
  );
}

export function FamilyAccess() {
  const { t, i18n } = useTranslation();
  const meta = useVault((s) => s.meta);
  const keys = useVault((s) => s.keys);
  const userId = useVault((s) => s.userId);
  const { isPro } = useIsPro();

  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [justCreated, setJustCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!keys?.dek || !userId) return;
    let alive = true;
    listShares(keys.dek, userId)
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [keys, userId]);

  const create = async () => {
    if (!meta || !keys?.dek || !userId) return;
    setErr("");
    setCreating(true);
    try {
      const lang = (i18n.resolvedLanguage ?? "pt").slice(0, 2);
      const row = await createShare(meta, keys.dek, userId, password, label.trim(), lang);
      setRows((r) => [row, ...(r ?? [])]);
      setJustCreated(row.id);
      setPassword("");
      setLabel("");
    } catch {
      setErr("Senha incorreta ou não foi possível criar o acesso.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeShare(id);
      setRows((r) => (r ?? []).filter((x) => x.id !== id));
      if (justCreated === id) setJustCreated(null);
    } catch {
      setErr("Não foi possível revogar. Tente de novo.");
    }
  };

  const count = rows?.length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 items-start">
      {/* Coluna esquerda: aviso de privacidade + criar novo acesso */}
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 rounded-[12px] border border-amber-500/30 bg-amber-500/[0.05] p-4">
          <ShieldAlert size={17} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-muted leading-relaxed">
            Crie um link com PIN pra alguém de confiança <b className="text-text">ver</b> o seu painel (só leitura — não
            dá pra editar). <b className="text-text">Quem tiver o link e o PIN vê todos os seus números.</b> Por
            segurança, mande o PIN por um canal diferente do link. Você pode revogar o acesso a qualquer momento.
          </p>
        </div>

        {!isPro ? (
          <ProUpsell title={t("pro.benefit1")} desc={t("pro.benefit1Desc")} feature="familia" />
        ) : (
        <div className="rounded-[14px] border border-border bg-bg2 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-text">
            <Users size={16} className="text-muted" /> Novo acesso
          </div>
          {err ? <p className="text-[12.5px] text-red-400">{err}</p> : null}
          <Input
            aria-label="Nome (opcional)"
            placeholder="Pra quem? (ex.: Esposa) — opcional"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
          />
          <Input
            type="password"
            aria-label="Sua senha"
            autoComplete="current-password"
            placeholder="Sua senha (pra confirmar)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Btn tone="teal" className="w-full" disabled={creating || password.length === 0} onClick={create}>
            {creating ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : <>Criar acesso</>}
          </Btn>
          <p className="text-[11.5px] text-faint leading-relaxed">
            O segredo do link nunca chega ao servidor — fica só no link. O PIN é um 2º fator com bloqueio por tentativas.
          </p>
        </div>
        )}
      </div>

      {/* Coluna direita: acessos ativos */}
      <div className="space-y-3">
        <div className="eyebrow text-faint">
          Acessos ativos{count > 0 ? ` · ${count}` : ""}
        </div>
        {rows === null ? (
          <p className="text-[12.5px] text-faint">Carregando…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-border p-6 text-center">
            <p className="text-[12.5px] text-faint">Nenhum acesso ativo ainda.</p>
          </div>
        ) : (
          rows.map((row) => (
            <ShareCard key={row.id} row={row} onRevoke={() => void revoke(row.id)} highlight={justCreated === row.id} />
          ))
        )}
      </div>
    </div>
  );
}
