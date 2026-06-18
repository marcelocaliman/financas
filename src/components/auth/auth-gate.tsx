import { useState } from "react";
import { useVault } from "@/vault/vault-store";
import { AuthShell, Field, SubmitButton, ErrorText, LinkButton, SocialRow } from "./auth-shell";
import { PrivacyLink } from "@/components/privacy-policy";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

function msg(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/User already registered/i.test(m)) return "Já existe uma conta com esse e-mail.";
  if (/should be at least|Password/i.test(m)) return "Senha muito curta (mínimo 6 caracteres).";
  if (/signups? not allowed|signups? are disabled|signup.*disabled/i.test(m))
    return "O cadastro está fechado no momento. Em breve abrimos — fique de olho.";
  return fallback;
}

/**
 * Só uma chave/senha REALMENTE errada faz o AES-GCM falhar a autenticação
 * (DOMException "OperationError"). Qualquer outra coisa — cripto não carregou,
 * rede, bundle inconsistente durante uma atualização — NÃO é senha errada e não
 * deve assustar o usuário dizendo que é.
 */
function isWrongSecret(e: unknown): boolean {
  return e instanceof DOMException && e.name === "OperationError";
}

const RELOAD_HINT = "Recarregue a página e tente de novo.";

/** Decide a tela conforme o estado do cofre. */
export function AuthGate() {
  const status = useVault((s) => s.status);
  if (status === "locked") return <UnlockFlow />;
  return <SignedOutFlow />;
}

// ── Não autenticado: login ↔ cadastro ──────────────────────────────────────
function SignedOutFlow() {
  // Modo inicial vem da URL: /app#signup (ou #criar) abre direto no cadastro; senão, login.
  const initial: "login" | "signup" =
    typeof window !== "undefined" && /signup|criar/i.test(window.location.hash) ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initial);
  return mode === "login" ? (
    <Login onSignup={() => setMode("signup")} />
  ) : (
    <Signup onLogin={() => setMode("login")} />
  );
}

function Login({ onSignup }: { onSignup: () => void }) {
  const signIn = useVault((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      track("login");
    } catch (e2) {
      setErr(msg(e2, "Não foi possível entrar."));
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    setErr("");
    if (!email.trim()) return setErr("Digite seu e-mail primeiro.");
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      setResetSent(true);
    } catch (e2) {
      setErr(msg(e2, "Não foi possível enviar o e-mail."));
    }
  };

  return (
    <AuthShell
      title="Entrar"
      subtitle="Seus dados são cifrados no seu aparelho. O servidor nunca os vê em claro."
      footer={
        <>
          Não tem conta? <LinkButton onClick={onSignup}>Criar conta</LinkButton>
        </>
      }
    >
      {resetSent ? (
        <p className="text-[13px] text-muted leading-relaxed">
          Enviamos um link de redefinição pra <b className="text-text">{email}</b>. Depois de
          redefinir a senha de acesso, você vai precisar do <b className="text-text">código de
          recuperação</b> pra destravar o cofre.
        </p>
      ) : (
        <>
          <form onSubmit={submit}>
            <ErrorText>{err}</ErrorText>
            <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <SubmitButton loading={loading}>Entrar</SubmitButton>
            <div className="text-center mt-3 text-[12.5px]">
              <LinkButton onClick={forgot}>Esqueci minha senha</LinkButton>
            </div>
          </form>
          <SocialRow verb="entre" />
        </>
      )}
    </AuthShell>
  );
}

function Signup({ onLogin }: { onLogin: () => void }) {
  const signUp = useVault((s) => s.signUp);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentConfirm, setSentConfirm] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) return setErr("Use uma senha de pelo menos 8 caracteres.");
    if (password !== confirm) return setErr("As senhas não coincidem.");
    if (!consent) return setErr("Pra criar a conta, aceite a Política de Privacidade.");
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email.trim(), password);
      track("signup");
      if (needsConfirmation) setSentConfirm(true);
    } catch (e2) {
      setErr(msg(e2, "Não foi possível criar a conta."));
    } finally {
      setLoading(false);
    }
  };

  if (sentConfirm) {
    return (
      <AuthShell title="Confirme seu e-mail" footer={<LinkButton onClick={onLogin}>Voltar ao login</LinkButton>}>
        <p className="text-[13px] text-muted leading-relaxed">
          Enviamos um link de confirmação pra <b className="text-text">{email}</b>. Clique nele e
          depois entre — no primeiro acesso seu cofre é criado e mostramos o{" "}
          <b className="text-text">código de recuperação</b> (anote num lugar seguro).
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Sua senha vira a chave de criptografia — escolha uma forte e não a perca."
      footer={
        <>
          Já tem conta? <LinkButton onClick={onLogin}>Entrar</LinkButton>
        </>
      }
    >
      <form onSubmit={submit}>
        <ErrorText>{err}</ErrorText>
        <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Field label="Repita a senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <div className="flex items-start gap-2.5 mb-4 text-[12.5px] text-muted leading-relaxed">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>
            <label htmlFor="consent" className="cursor-pointer">
              Li e aceito a{" "}
            </label>
            <PrivacyLink label="Política de Privacidade" className="text-accent hover:underline font-medium" />.
          </span>
        </div>
        <SubmitButton loading={loading}>Criar conta</SubmitButton>
      </form>
      <SocialRow verb="cadastre-se" />
    </AuthShell>
  );
}

// ── Autenticado, cofre trancado: senha ↔ código de recuperação ──────────────
function UnlockFlow() {
  const [mode, setMode] = useState<"password" | "recovery">("password");
  return mode === "password" ? (
    <Unlock onRecovery={() => setMode("recovery")} />
  ) : (
    <Recovery onBack={() => setMode("password")} />
  );
}

function Unlock({ onRecovery }: { onRecovery: () => void }) {
  const unlock = useVault((s) => s.unlock);
  const signOut = useVault((s) => s.signOut);
  const email = useVault((s) => s.email);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await unlock(password);
    } catch (e2) {
      setErr(isWrongSecret(e2) ? "Senha incorreta." : `Não foi possível destravar. ${RELOAD_HINT}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Destravar o cofre"
      subtitle={
        <>
          Conectado como <b className="text-text">{email}</b>. Digite sua senha pra decifrar seus
          dados neste aparelho.
        </>
      }
      footer={<LinkButton onClick={() => void signOut()}>Sair</LinkButton>}
    >
      <form onSubmit={submit}>
        <ErrorText>{err}</ErrorText>
        <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        <SubmitButton loading={loading}>Destravar</SubmitButton>
        <div className="text-center mt-3 text-[12.5px]">
          <LinkButton onClick={onRecovery}>Esqueci a senha — usar código de recuperação</LinkButton>
        </div>
      </form>
    </AuthShell>
  );
}

function Recovery({ onBack }: { onBack: () => void }) {
  const recoverAndReset = useVault((s) => s.recoverAndReset);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) return setErr("Use uma nova senha de pelo menos 8 caracteres.");
    if (password !== confirm) return setErr("As senhas não coincidem.");
    setLoading(true);
    try {
      await recoverAndReset(code.trim(), password);
    } catch (e2) {
      setErr(
        isWrongSecret(e2)
          ? "Código de recuperação inválido."
          : `Não foi possível recuperar. ${RELOAD_HINT}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar com o código"
      subtitle="Digite seu código de recuperação e defina uma nova senha."
      footer={<LinkButton onClick={onBack}>Voltar</LinkButton>}
    >
      <form onSubmit={submit}>
        <ErrorText>{err}</ErrorText>
        <Field label="Código de recuperação" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX-…" autoFocus required />
        <Field label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Field label="Repita a nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <SubmitButton loading={loading}>Recuperar e entrar</SubmitButton>
      </form>
    </AuthShell>
  );
}
