import { useState } from "react";
import { useVault } from "@/vault/vault-store";
import { Panel } from "@/components/common/panel";
import { cn } from "@/lib/utils";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-9 px-3 rounded-[7px] border border-border bg-card text-[13px] text-text outline-none focus:border-teal"
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
        "h-9 px-3 rounded-[7px] text-[13px] font-medium transition-colors disabled:opacity-50",
        tone === "teal"
          ? "bg-teal text-white"
          : tone === "danger"
            ? "border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            : "border border-border text-muted hover:text-text",
        className,
      )}
    />
  );
}

export function AccountSettings() {
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);

  return (
    <div className="space-y-5">
      <Panel className="p-6">
        <div className="text-[15px] font-semibold">Conta</div>
        <div className="text-[12.5px] text-muted mt-0.5">{email}</div>
        <div className="flex gap-2 mt-3">
          <Btn onClick={lock}>Trancar o cofre</Btn>
          <Btn onClick={() => void signOut()}>Sair</Btn>
        </div>
      </Panel>

      <ChangePassword />
      <NewRecoveryCode />
      <DangerZone />
    </div>
  );
}

function ChangePassword() {
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
    <Panel className="p-6 space-y-3">
      <div className="text-[15px] font-semibold">Trocar senha</div>
      {err ? <p className="text-[12.5px] text-red-600">{err}</p> : null}
      {state === "ok" ? <p className="text-[12.5px] text-teal">Senha alterada.</p> : null}
      <Input type="password" placeholder="Senha atual" value={cur} onChange={(e) => setCur(e.target.value)} />
      <Input type="password" placeholder="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} />
      <Input type="password" placeholder="Repita a nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Btn tone="teal" disabled={state === "loading"} onClick={submit}>
        {state === "loading" ? "Salvando…" : "Trocar senha"}
      </Btn>
      <p className="text-[11.5px] text-faint leading-relaxed">
        A senha re-cifra apenas a chave (o cofre não é recifrado). Seu código de recuperação continua válido.
      </p>
    </Panel>
  );
}

function NewRecoveryCode() {
  const rotateRecovery = useVault((s) => s.rotateRecovery);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      await rotateRecovery(password); // dispara o diálogo do novo código
      setPassword("");
    } catch {
      setErr("Senha incorreta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="p-6 space-y-3">
      <div className="text-[15px] font-semibold">Novo código de recuperação</div>
      <p className="text-[12.5px] text-muted leading-relaxed">
        Gera um código novo e invalida o anterior. Confirme com sua senha.
      </p>
      {err ? <p className="text-[12.5px] text-red-600">{err}</p> : null}
      <Input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Btn disabled={loading} onClick={submit}>{loading ? "Gerando…" : "Gerar novo código"}</Btn>
    </Panel>
  );
}

function DangerZone() {
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
    <Panel className="p-6 space-y-3 border-red-200 dark:border-red-900/40">
      <div className="text-[15px] font-semibold text-red-600">Excluir conta</div>
      <p className="text-[12.5px] text-muted leading-relaxed">
        Apaga sua conta e o cofre cifrado <b className="text-text">para sempre</b>. Não há como desfazer.
      </p>
      {!open ? (
        <Btn tone="danger" onClick={() => setOpen(true)}>Excluir minha conta</Btn>
      ) : (
        <>
          {err ? <p className="text-[12.5px] text-red-600">{err}</p> : null}
          <Input placeholder='Digite EXCLUIR pra confirmar' value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div className="flex gap-2">
            <Btn onClick={() => { setOpen(false); setConfirm(""); }}>Cancelar</Btn>
            <Btn tone="danger" disabled={confirm !== "EXCLUIR" || loading} onClick={submit}>
              {loading ? "Excluindo…" : "Excluir definitivamente"}
            </Btn>
          </div>
        </>
      )}
    </Panel>
  );
}
