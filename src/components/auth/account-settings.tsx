import { useState } from "react";
import { useVault } from "@/vault/vault-store";
import { cn } from "@/lib/utils";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full max-w-sm h-10 px-3 rounded-[8px] border border-border bg-bg2 text-[13.5px] text-text outline-none focus:border-accent transition-colors"
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
        "h-9 px-3.5 rounded-[8px] text-[13px] font-medium transition-colors disabled:opacity-50",
        tone === "teal"
          ? "bg-accent text-[#0b0c0e] hover:brightness-110"
          : tone === "danger"
            ? "border border-red-400/50 text-red-400 hover:bg-red-500/10"
            : "border border-border text-muted hover:text-text hover:bg-card-hover",
        className,
      )}
    />
  );
}

function Heading({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <h3 className={cn("text-[14px] font-semibold", danger ? "text-red-400" : "text-text")}>{children}</h3>
  );
}

export function AccountSection() {
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);

  return (
    <div>
      <Heading>Conta</Heading>
      <div className="text-[12.5px] text-muted mt-1 break-all">{email}</div>
      <div className="flex gap-2 mt-4">
        <Btn onClick={lock}>Trancar o cofre</Btn>
        <Btn onClick={() => void signOut()}>Sair</Btn>
      </div>
    </div>
  );
}

export function ChangePassword() {
  const changePassword = useVault((s) => s.changePassword);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok">("idle");
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (next.length < 8) return setErr("Nova senha: mínimo 8 caracteres.");
    if (next !== confirm) return setErr("As senhas não coincidem.");
    setState("loading");
    try {
      await changePassword(cur, next);
      setState("ok");
      setCur("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setState("idle");
      setErr(e instanceof Error && /version|update/i.test(e.message) ? "Falha ao salvar." : "Senha atual incorreta.");
    }
  };

  return (
    <div className="space-y-3">
      <Heading>Trocar senha</Heading>
      {err ? <p className="text-[12.5px] text-red-400">{err}</p> : null}
      {state === "ok" ? <p className="text-[12.5px] text-accent">Senha alterada.</p> : null}
      <Input type="password" placeholder="Senha atual" value={cur} onChange={(e) => setCur(e.target.value)} />
      <Input type="password" placeholder="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} />
      <Input type="password" placeholder="Repita a nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Btn tone="teal" disabled={state === "loading"} onClick={submit}>
        {state === "loading" ? "Salvando…" : "Trocar senha"}
      </Btn>
      <p className="text-[11.5px] text-faint leading-relaxed">
        A senha re-cifra apenas a chave (o cofre não é recifrado). Seu código de recuperação continua válido.
      </p>
    </div>
  );
}

export function NewRecoveryCode() {
  const rotateRecovery = useVault((s) => s.rotateRecovery);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      await rotateRecovery(password);
      setPassword("");
    } catch {
      setErr("Senha incorreta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Heading>Novo código de recuperação</Heading>
      <p className="text-[12.5px] text-muted leading-relaxed">
        Gera um código novo e invalida o anterior. Confirme com sua senha.
      </p>
      {err ? <p className="text-[12.5px] text-red-400">{err}</p> : null}
      <Input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Btn disabled={loading} onClick={submit}>{loading ? "Gerando…" : "Gerar novo código"}</Btn>
    </div>
  );
}

export function DangerZone() {
  const deleteAccount = useVault((s) => s.deleteAccount);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      await deleteAccount();
    } catch {
      setErr("Não foi possível excluir. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-red-500/30 bg-red-500/[0.04] p-5 space-y-3">
      <Heading danger>Excluir conta</Heading>
      <p className="text-[12.5px] text-muted leading-relaxed">
        Apaga sua conta e o cofre cifrado <b className="text-text">para sempre</b>. Não há como desfazer.
      </p>
      {!open ? (
        <Btn tone="danger" onClick={() => setOpen(true)}>Excluir minha conta</Btn>
      ) : (
        <>
          {err ? <p className="text-[12.5px] text-red-400">{err}</p> : null}
          <Input placeholder="Digite EXCLUIR pra confirmar" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div className="flex gap-2">
            <Btn onClick={() => { setOpen(false); setConfirm(""); }}>Cancelar</Btn>
            <Btn tone="danger" disabled={confirm !== "EXCLUIR" || loading} onClick={submit}>
              {loading ? "Excluindo…" : "Excluir definitivamente"}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
